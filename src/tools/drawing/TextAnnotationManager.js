import Utils from "../../utils/Utils";

class TextAnnotationManager {
  /**
   * @param {HTMLElement} chartDiv - The chart container element
   * @param {SVGElement} svgOverlay - The SVG overlay element
   * @param {Object} coordinateConverter - The coordinate converter utility
   * @param {Function} onTextCreated - Callback when text is created
   */
  constructor(chartDiv, svgOverlay, coordinateConverter, onTextCreated) {
    this.svgOverlay = svgOverlay;
    this.chartDiv = chartDiv;
    this.coordinateConverter = coordinateConverter;
    this.onTextCreated = onTextCreated;

    // Current state
    this.isEditing = false;
    this.clickX = 0;
    this.clickY = 0;
    this.currentGroup = null;
    this.currentData = null;

    // Editor elements
    this.editor = null;
    this.toolbar = null;

    // Default style
    this.textStyle = {
      fontSize: 14,
      fontFamily: "Arial, sans-serif",
      fontWeight: "normal",
      fontStyle: "normal",
      textDecoration: "none",
      color: "#0077b6",
      backgroundColor: "#ffffff", // Default background color
      backgroundOpacity: 0.7, // Default background opacity
    };

    // Create toolbar
    this.createToolbar();

    // Bind methods
    this.handleOutsideClick = this.handleOutsideClick.bind(this);
  }

  /**
   * Creates a new text annotation at the specified position
   * @param {number} x - Screen x coordinate
   * @param {number} y - Screen y coordinate
   * @param {Object} dataPoint - Data coordinates
   * @param {string} color - Text color
   * @returns {Object} - Created element and data
   */
  createTextAnnotation(x, y, dataPoint, color) {
    // Save the initial click position
    this.clickX = x;
    this.clickY = y;

    // Create a simple group as placeholder
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("apexstock-text-annotation");

    const id = Utils.generateUniqueId("text");
    group.dataset.elementId = id;

    // Create initial data object
    this.currentData = {
      id,
      type: "text",
      x: dataPoint.x,
      y: dataPoint.y,
      clickX: x,
      clickY: y,
      text: "",
      color: color || this.textStyle.color,
      backgroundColor: this.textStyle.backgroundColor,
      backgroundOpacity: this.textStyle.backgroundOpacity,
      ...this.textStyle,
    };

    this.currentGroup = group;

    // Begin editing
    this.startEditing();

    // Return initial placeholder
    return {
      element: group,
      data: this.currentData,
    };
  }

  /**
   * Creates the formatting toolbar
   */
  createToolbar() {
    const toolbar = document.createElement("div");
    toolbar.className = "apexstock-text-toolbar";
    toolbar.style.position = "absolute";
    toolbar.style.display = "none";
    toolbar.style.zIndex = "1001";
    toolbar.style.background = "#f8f9fa";
    toolbar.style.border = "1px solid #dee2e6";
    toolbar.style.borderRadius = "4px";
    toolbar.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.1)";
    toolbar.style.padding = "5px";

    // Bold button
    const boldBtn = document.createElement("button");
    boldBtn.innerHTML = "<strong>B</strong>";
    boldBtn.addEventListener("click", () => {
      this.toggleStyle("fontWeight", "bold", "normal");
    });

    // Italic button
    const italicBtn = document.createElement("button");
    italicBtn.innerHTML = "<em>I</em>";
    italicBtn.addEventListener("click", () => {
      this.toggleStyle("fontStyle", "italic", "normal");
    });

    // Underline button
    const underlineBtn = document.createElement("button");
    underlineBtn.innerHTML = "<u>U</u>";
    underlineBtn.addEventListener("click", () => {
      this.toggleStyle("textDecoration", "underline", "none");
    });

    // Text color picker
    const textColorWrapper = document.createElement("div");
    textColorWrapper.style.display = "inline-block";
    textColorWrapper.style.position = "relative";

    const textColorLabel = document.createElement("label");
    textColorLabel.textContent = "Text";
    textColorLabel.style.fontSize = "10px";
    textColorLabel.style.display = "block";
    textColorLabel.style.textAlign = "center";

    const textColorPicker = document.createElement("input");
    textColorPicker.type = "color";
    textColorPicker.value = this.textStyle.color;
    textColorPicker.style.width = "24px";
    textColorPicker.style.height = "24px";
    textColorPicker.style.padding = "0";
    textColorPicker.style.border = "1px solid #ccc";
    textColorPicker.style.borderRadius = "2px";
    textColorPicker.addEventListener("input", (e) => {
      this.setStyle("color", e.target.value);
    });

    textColorWrapper.appendChild(textColorLabel);
    textColorWrapper.appendChild(textColorPicker);

    // Background color picker
    const bgColorWrapper = document.createElement("div");
    bgColorWrapper.style.display = "inline-block";
    bgColorWrapper.style.position = "relative";
    bgColorWrapper.style.marginLeft = "5px";

    const bgColorLabel = document.createElement("label");
    bgColorLabel.textContent = "Background";
    bgColorLabel.style.fontSize = "10px";
    bgColorLabel.style.display = "block";
    bgColorLabel.style.textAlign = "center";

    const bgColorPicker = document.createElement("input");
    bgColorPicker.type = "color";
    bgColorPicker.value = this.textStyle.backgroundColor;
    bgColorPicker.style.width = "24px";
    bgColorPicker.style.height = "24px";
    bgColorPicker.style.padding = "0";
    bgColorPicker.style.border = "1px solid #ccc";
    bgColorPicker.style.borderRadius = "2px";
    bgColorPicker.addEventListener("input", (e) => {
      this.setStyle("backgroundColor", e.target.value);
    });

    bgColorWrapper.appendChild(bgColorLabel);
    bgColorWrapper.appendChild(bgColorPicker);

    // Background opacity slider
    const opacityWrapper = document.createElement("div");
    opacityWrapper.style.display = "inline-block";
    opacityWrapper.style.position = "relative";
    opacityWrapper.style.marginLeft = "5px";

    const opacityLabel = document.createElement("label");
    opacityLabel.textContent = "Opacity";
    opacityLabel.style.fontSize = "10px";
    opacityLabel.style.display = "block";
    opacityLabel.style.textAlign = "center";

    const opacitySlider = document.createElement("input");
    opacitySlider.type = "range";
    opacitySlider.min = "0";
    opacitySlider.max = "100";
    opacitySlider.value = this.textStyle.backgroundOpacity * 100;
    opacitySlider.style.width = "60px";
    opacitySlider.style.height = "8px";
    opacitySlider.style.marginTop = "8px";
    opacitySlider.addEventListener("input", (e) => {
      this.setStyle("backgroundOpacity", parseInt(e.target.value) / 100);
    });

    opacityWrapper.appendChild(opacityLabel);
    opacityWrapper.appendChild(opacitySlider);

    // Font size
    const sizeSelect = document.createElement("select");
    [10, 12, 14, 16, 18, 20, 24].forEach((size) => {
      const option = document.createElement("option");
      option.value = size;
      option.text = size + "px";
      if (size === this.textStyle.fontSize) {
        option.selected = true;
      }
      sizeSelect.appendChild(option);
    });
    sizeSelect.addEventListener("change", () => {
      this.setStyle("fontSize", parseInt(sizeSelect.value));
    });

    // Font family
    const familySelect = document.createElement("select");
    [
      "Arial, sans-serif",
      "Courier New, monospace",
      "Helvetica, Arial, sans-serif",
      "Verdana, Geneva, sans-serif",
      "Tahoma, Geneva, sans-serif",
      "Trebuchet MS, Helvetica, sans-serif",
      "Segoe UI, Helvetica, sans-serif",
      "Consolas, Monaco, monospace",
      "Menlo, Consolas, monospace",
      "Times New Roman, serif",
      "Georgia, Times New Roman, serif",
      "Cambria, Georgia, serif",
    ].forEach((family) => {
      const option = document.createElement("option");
      option.value = family;
      option.text = family.split(",")[0];
      if (family === this.textStyle.fontFamily) {
        option.selected = true;
      }
      familySelect.appendChild(option);
    });
    familySelect.addEventListener("change", () => {
      this.setStyle("fontFamily", familySelect.value);
    });

    // Apply button
    const applyBtn = document.createElement("button");
    applyBtn.textContent = "✓";
    applyBtn.addEventListener("click", () => {
      this.finishEditing();
    });

    // Cancel button
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "✕";
    cancelBtn.addEventListener("click", () => {
      this.cancelEditing();
    });

    // Create a container for font controls
    const fontControls = document.createElement("div");
    fontControls.style.display = "flex";
    fontControls.style.gap = "5px";
    fontControls.style.marginBottom = "8px";

    // Add font controls
    fontControls.appendChild(sizeSelect);
    fontControls.appendChild(familySelect);
    fontControls.appendChild(boldBtn);
    fontControls.appendChild(italicBtn);
    fontControls.appendChild(underlineBtn);

    // Create a container for color controls
    const colorControls = document.createElement("div");
    colorControls.style.display = "flex";
    colorControls.style.gap = "5px";
    colorControls.style.marginBottom = "8px";

    // Add color controls
    colorControls.appendChild(textColorWrapper);
    colorControls.appendChild(bgColorWrapper);
    colorControls.appendChild(opacityWrapper);

    // Create a container for action buttons
    const actionControls = document.createElement("div");
    actionControls.style.display = "flex";
    actionControls.style.gap = "5px";
    actionControls.style.justifyContent = "flex-end";

    // Add action buttons
    actionControls.appendChild(cancelBtn);
    actionControls.appendChild(applyBtn);

    // Add all control groups to toolbar
    toolbar.appendChild(fontControls);
    toolbar.appendChild(colorControls);
    toolbar.appendChild(actionControls);

    // Style buttons
    const buttons = toolbar.querySelectorAll("button");
    buttons.forEach((btn) => {
      btn.style.width = "28px";
      btn.style.height = "28px";
      btn.style.margin = "0 2px";
      btn.style.background = "#fff";
      btn.style.border = "1px solid #ced4da";
      btn.style.borderRadius = "4px";
      btn.style.cursor = "pointer";
    });

    const selects = toolbar.querySelectorAll("select");
    selects.forEach((select) => {
      select.style.height = "28px";
      select.style.margin = "0 2px";
      select.style.background = "#fff";
      select.style.border = "1px solid #ced4da";
      select.style.borderRadius = "4px";
      select.style.cursor = "pointer";
    });

    this.chartDiv.appendChild(toolbar);
    this.toolbar = toolbar;
  }

  /**
   * Start editing a text annotation
   */
  startEditing() {
    if (this.isEditing) return;
    this.isEditing = true;

    // Create editor
    const editor = document.createElement("div");
    editor.className = "apexstock-text-editor";
    editor.contentEditable = true;
    editor.style.position = "absolute";
    editor.style.left = this.clickX + "px";
    editor.style.top = this.clickY + "px";
    editor.style.minWidth = "100px";
    editor.style.minHeight = this.textStyle.fontSize + "px";
    editor.style.padding = "5px";
    editor.style.background = this.currentData.backgroundColor || "#ffffff";
    editor.style.opacity = this.currentData.backgroundOpacity || 0.7;
    editor.style.border = "1px solid #007bff";
    editor.style.borderRadius = "3px";
    editor.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.1)";
    editor.style.zIndex = "1000";
    editor.style.fontFamily = this.currentData.fontFamily;
    editor.style.fontSize = this.currentData.fontSize + "px";
    editor.style.fontWeight = this.currentData.fontWeight;
    editor.style.fontStyle = this.currentData.fontStyle;
    editor.style.textDecoration = this.currentData.textDecoration;
    editor.style.color = this.currentData.color;

    // Add to DOM
    this.chartDiv.appendChild(editor);
    this.editor = editor;

    // Focus editor
    setTimeout(() => {
      editor.focus();
      // Show toolbar above editor
      this.showToolbar(this.clickX, this.clickY - 150);
    }, 10);

    // Handle keyboard events
    editor.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.cancelEditing();
        e.preventDefault();
      } else if (e.key === "Enter" && !e.shiftKey) {
        this.finishEditing();
        e.preventDefault();
      }
    });

    // Handle outside clicks
    document.addEventListener("mousedown", this.handleOutsideClick);
  }

  /**
   * Display the formatting toolbar
   * @param {number} x - Screen X position
   * @param {number} y - Screen Y position
   */
  showToolbar(x, y) {
    if (!this.toolbar) return;

    // Adjust position to stay in viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    this.toolbar.style.display = "flex";
    this.toolbar.style.flexDirection = "column";
    const toolbarWidth = this.toolbar.offsetWidth;
    const toolbarHeight = this.toolbar.offsetHeight;

    // Adjust horizontal position
    let toolbarX = x;
    if (toolbarX + toolbarWidth > viewportWidth) {
      toolbarX = Math.max(5, viewportWidth - toolbarWidth - 5);
    }

    // Adjust vertical position
    let toolbarY = y;
    if (toolbarY < 5) {
      toolbarY = this.clickY + 30; // Position below editor
    }

    this.toolbar.style.left = toolbarX + "px";
    this.toolbar.style.top = toolbarY + "px";
  }

  /**
   * Handle clicks outside the editor
   * @param {MouseEvent} e - Mouse event
   */
  handleOutsideClick(e) {
    if (!this.isEditing) return;

    if (
      this.editor &&
      !this.editor.contains(e.target) &&
      this.toolbar &&
      !this.toolbar.contains(e.target)
    ) {
      // Prevent this click from affecting position
      e.preventDefault();
      this.finishEditing();
    }
  }

  /**
   * Finish editing and commit the text annotation
   */
  finishEditing() {
    if (!this.isEditing || !this.editor) return;

    // Get text content
    const text = this.editor.textContent.trim();

    if (!text) {
      this.cancelEditing();
      return;
    }

    // Save text to data
    this.currentData.text = text;

    // Create SVG elements
    this.createSvgText();

    // Clean up
    this.cleanup();
  }

  /**
   * Create the SVG text element from the edited content
   */
  createSvgText() {
    // Clear current group
    if (this.currentGroup) {
      while (this.currentGroup.firstChild) {
        this.currentGroup.removeChild(this.currentGroup.firstChild);
      }
    } else {
      // Create new group if needed
      this.currentGroup = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g"
      );
      this.currentGroup.classList.add("apexstock-text-annotation");

      // Set element ID as data attribute
      if (this.currentData.id) {
        this.currentGroup.dataset.elementId = this.currentData.id;
      }
    }

    // Make sure group is in the DOM
    if (!this.currentGroup.parentNode) {
      this.svgOverlay.appendChild(this.currentGroup);
    }

    // Create background rectangle
    const background = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    background.setAttribute(
      "fill",
      this.currentData.backgroundColor || "#ffffff"
    );
    background.setAttribute(
      "fill-opacity",
      this.currentData.backgroundOpacity || 0.7
    );
    background.setAttribute("rx", "3");

    // Create text element
    const textElem = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    textElem.setAttribute("x", this.clickX);
    textElem.setAttribute("y", this.clickY);
    textElem.setAttribute("font-family", this.currentData.fontFamily);
    textElem.setAttribute("font-size", this.currentData.fontSize + "px");
    textElem.setAttribute("font-weight", this.currentData.fontWeight);
    textElem.setAttribute("font-style", this.currentData.fontStyle);
    textElem.setAttribute("text-decoration", this.currentData.textDecoration);
    textElem.setAttribute("fill", this.currentData.color);
    textElem.setAttribute("dominant-baseline", "text-before-edge");

    // Add text lines as tspans
    const lines = this.currentData.text.split("\n");
    lines.forEach((line, i) => {
      const tspan = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "tspan"
      );
      tspan.textContent = line;
      tspan.setAttribute("x", this.clickX);
      tspan.setAttribute("dy", i === 0 ? "0" : "1.2em");
      textElem.appendChild(tspan);
    });

    // Add text to group
    this.currentGroup.appendChild(textElem);

    // Size the background based on the text
    try {
      const bbox = textElem.getBBox();
      const padding = 5;

      background.setAttribute("x", bbox.x - padding);
      background.setAttribute("y", bbox.y - padding);
      background.setAttribute("width", bbox.width + padding * 2);
      background.setAttribute("height", bbox.height + padding * 2);

      // Insert background before text (to be behind it)
      this.currentGroup.insertBefore(background, textElem);
    } catch (e) {
      console.error("Error measuring text:", e);

      // Fallback if getBBox fails
      background.setAttribute("x", this.clickX - 5);
      background.setAttribute("y", this.clickY - 5);
      background.setAttribute("width", 100);
      background.setAttribute("height", 30);
      this.currentGroup.insertBefore(background, textElem);
    }

    // Notify parent
    if (this.onTextCreated) {
      this.onTextCreated(this.currentGroup, this.currentData);
    }
  }

  /**
   * Cancel editing and discard changes
   */
  cancelEditing() {
    if (!this.isEditing) return;

    // Remove current group if it's a new annotation
    if (this.currentGroup && this.currentGroup.parentNode) {
      this.currentGroup.parentNode.removeChild(this.currentGroup);
    }

    this.cleanup();
  }

  /**
   * Clean up UI elements after editing
   */
  cleanup() {
    // Remove editor
    if (this.editor && this.editor.parentNode) {
      this.editor.parentNode.removeChild(this.editor);
      this.editor = null;
    }

    // Hide toolbar
    if (this.toolbar) {
      this.toolbar.style.display = "none";
    }

    // Remove document click handler
    document.removeEventListener("mousedown", this.handleOutsideClick);

    this.isEditing = false;
  }

  /**
   * Toggle a style property between two values
   * @param {string} property - Style property to toggle
   * @param {*} value1 - First possible value
   * @param {*} value2 - Second possible value
   */
  toggleStyle(property, value1, value2) {
    if (!this.currentData || !this.editor) return;

    const currentValue = this.currentData[property];
    const newValue = currentValue === value1 ? value2 : value1;

    this.setStyle(property, newValue);
  }

  /**
   * Set a style property to a specific value
   * @param {string} property - Style property to set
   * @param {*} value - Value to set
   */
  setStyle(property, value) {
    if (!this.currentData || !this.editor) return;

    this.currentData[property] = value;

    // Update editor style
    switch (property) {
      case "fontSize":
        this.editor.style.fontSize = value + "px";
        break;
      case "fontFamily":
        this.editor.style.fontFamily = value;
        break;
      case "fontWeight":
        this.editor.style.fontWeight = value;
        break;
      case "fontStyle":
        this.editor.style.fontStyle = value;
        break;
      case "textDecoration":
        this.editor.style.textDecoration = value;
        break;
      case "color":
        this.editor.style.color = value;
        break;
      case "backgroundColor":
        this.editor.style.backgroundColor = value;
        break;
      case "backgroundOpacity":
        this.editor.style.opacity = value;
        break;
    }
  }

  /**
   * Redraw a text element based on its data
   * @param {Object} data - The text annotation data
   * @returns {SVGElement} - The redrawn text element
   */
  redrawTextElement(data) {
    // Create new group
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("apexstock-text-annotation");

    // Set the element ID as a data attribute
    if (data.id) {
      group.dataset.elementId = data.id;
    } else {
      const id = Utils.generateUniqueId("text");
      group.dataset.elementId = id;
      data.id = id;
    }

    // Use the coordinate converter to determine the correct screen position
    let x, y;

    // Always use data coordinates for positioning during redraw
    const screenPos = this.coordinateConverter.dataToScreen(data.x, data.y);
    x = screenPos.x;
    y = screenPos.y;
    // Only fall back to clickX/Y if data coordinates are invalid
    if (isNaN(screenPos.x) || isNaN(screenPos.y)) {
      x = data.clickX || 0;
      y = data.clickY || 0;
    }

    // Create text element
    const textElem = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    textElem.setAttribute("x", x);
    textElem.setAttribute("y", y);
    textElem.setAttribute(
      "font-family",
      data.fontFamily || this.textStyle.fontFamily
    );
    textElem.setAttribute(
      "font-size",
      (data.fontSize || this.textStyle.fontSize) + "px"
    );
    textElem.setAttribute(
      "font-weight",
      data.fontWeight || this.textStyle.fontWeight
    );
    textElem.setAttribute(
      "font-style",
      data.fontStyle || this.textStyle.fontStyle
    );
    textElem.setAttribute(
      "text-decoration",
      data.textDecoration || this.textStyle.textDecoration
    );
    textElem.setAttribute("fill", data.color || this.textStyle.color);
    textElem.setAttribute("dominant-baseline", "text-before-edge");

    // Create background
    const background = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    background.setAttribute(
      "fill",
      data.backgroundColor || this.textStyle.backgroundColor
    );
    background.setAttribute(
      "fill-opacity",
      data.backgroundOpacity || this.textStyle.backgroundOpacity
    );
    background.setAttribute("rx", "3");

    // Add text lines
    const lines = (data.text || "").split("\n");
    lines.forEach((line, i) => {
      const tspan = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "tspan"
      );
      tspan.textContent = line;
      tspan.setAttribute("x", x);
      tspan.setAttribute("dy", i === 0 ? "0" : "1.2em");
      textElem.appendChild(tspan);
    });

    // Add text to group and SVG to measure size
    group.appendChild(textElem);
    this.svgOverlay.appendChild(group);

    // Size background based on text
    try {
      const bbox = textElem.getBBox();
      const padding = 5;

      background.setAttribute("x", bbox.x - padding);
      background.setAttribute("y", bbox.y - padding);
      background.setAttribute("width", bbox.width + padding * 2);
      background.setAttribute("height", bbox.height + padding * 2);
    } catch (e) {
      console.error("Error measuring text:", e);

      // Fallback if getBBox fails
      background.setAttribute("x", x - 5);
      background.setAttribute("y", y - 5);
      background.setAttribute("width", 100);
      background.setAttribute("height", 30);
    }

    // Rebuild group with background first
    this.svgOverlay.removeChild(group);
    group.innerHTML = "";
    group.appendChild(background);
    group.appendChild(textElem);

    // Update stored position information
    data.clickX = x;
    data.clickY = y;

    return group;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.cleanup();

    if (this.toolbar && this.toolbar.parentNode) {
      this.toolbar.parentNode.removeChild(this.toolbar);
      this.toolbar = null;
    }
  }
}

export default TextAnnotationManager;
