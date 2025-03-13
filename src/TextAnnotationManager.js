// TextAnnotationManager.js - Simple version with add-only functionality

class TextAnnotationManager {
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
    };

    // Create toolbar
    this.createToolbar();

    // Bind methods
    this.handleOutsideClick = this.handleOutsideClick.bind(this);
  }

  createTextAnnotation(x, y, dataPoint, color) {
    // Save the initial click position
    this.clickX = x;
    this.clickY = y;

    // Create a simple group as placeholder
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    // Create initial data object
    this.currentData = {
      type: "text",
      x: dataPoint.x,
      y: dataPoint.y,
      clickX: x,
      clickY: y,
      text: "",
      color: color || this.textStyle.color,
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
      "Times New Roman, serif",
      "Courier New, monospace",
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

    // Add buttons to toolbar
    toolbar.appendChild(sizeSelect);
    toolbar.appendChild(familySelect);
    toolbar.appendChild(boldBtn);
    toolbar.appendChild(italicBtn);
    toolbar.appendChild(underlineBtn);
    toolbar.appendChild(applyBtn);
    toolbar.appendChild(cancelBtn);

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
    editor.style.background = "white";
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
      this.showToolbar(this.clickX, this.clickY - 40);
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

  showToolbar(x, y) {
    if (!this.toolbar) return;

    // Adjust position to stay in viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    this.toolbar.style.display = "flex";
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
    background.setAttribute("fill", "white");
    background.setAttribute("fill-opacity", "0.7");
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

  cancelEditing() {
    if (!this.isEditing) return;

    // Remove current group if it's a new annotation
    if (this.currentGroup && this.currentGroup.parentNode) {
      this.currentGroup.parentNode.removeChild(this.currentGroup);
    }

    this.cleanup();
  }

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

  toggleStyle(property, value1, value2) {
    if (!this.currentData || !this.editor) return;

    const currentValue = this.currentData[property];
    const newValue = currentValue === value1 ? value2 : value1;

    this.setStyle(property, newValue);
  }

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
    }
  }

  redrawTextElement(data) {
    // Create new group
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("apexstock-text-annotation");

    // Store original position from data or calculate from coordinates
    const x =
      data.clickX !== undefined
        ? data.clickX
        : this.coordinateConverter.dataToScreen(data.x, data.y).x;
    const y =
      data.clickY !== undefined
        ? data.clickY
        : this.coordinateConverter.dataToScreen(data.x, data.y).y;

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
    background.setAttribute("fill", "white");
    background.setAttribute("fill-opacity", "0.7");
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

    return group;
  }

  destroy() {
    this.cleanup();

    if (this.toolbar && this.toolbar.parentNode) {
      this.toolbar.parentNode.removeChild(this.toolbar);
      this.toolbar = null;
    }
  }
}

export default TextAnnotationManager;
