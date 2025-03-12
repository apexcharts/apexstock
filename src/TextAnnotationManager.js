// TextAnnotationManager.js - Manages text annotations with inline editing and formatting

class TextAnnotationManager {
  /**
   * @param {SVGElement} svgOverlay - The SVG overlay element
   * @param {Function} coordinateConverter - The coordinate converter instance
   * @param {Function} onTextCreated - Callback when text annotation is created
   */
  constructor(svgOverlay, coordinateConverter, onTextCreated) {
    this.svgOverlay = svgOverlay;
    this.coordinateConverter = coordinateConverter;
    this.onTextCreated = onTextCreated;
    this.currentTextEditor = null;
    this.currentTextElement = null;
    this.currentTextData = null;
    this.isEditing = false;
    this.toolbarElement = null;

    // Default text styling
    this.textStyle = {
      fontSize: 14,
      fontFamily: "Arial, sans-serif",
      fontWeight: "normal",
      fontStyle: "normal",
      textDecoration: "none",
      color: "#0077b6",
      backgroundColor: "white",
      backgroundOpacity: 0.7,
      padding: 5,
    };

    // Create the text formatting toolbar (hidden initially)
    this.createTextToolbar();
  }

  /**
   * Creates a text annotation at the specified position
   * @param {number} x - Screen x coordinate
   * @param {number} y - Screen y coordinate
   * @param {Object} dataPoint - Data coordinates
   * @param {string} color - Current drawing color
   * @returns {Object} - The created text element and data
   */
  createTextAnnotation(x, y, dataPoint, color) {
    // Update text color from current drawing color
    this.textStyle.color = color;

    // Create group for the text annotation
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("apexstock-text-annotation");

    // Create background rectangle for improved readability
    const background = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    background.setAttribute("x", x - this.textStyle.padding);
    background.setAttribute(
      "y",
      y - this.textStyle.fontSize - this.textStyle.padding
    );
    background.setAttribute("width", "10"); // Initial width, will be updated
    background.setAttribute(
      "height",
      this.textStyle.fontSize + this.textStyle.padding * 2
    );
    background.setAttribute("fill", this.textStyle.backgroundColor);
    background.setAttribute("fill-opacity", this.textStyle.backgroundOpacity);
    background.setAttribute("rx", "3"); // Rounded corners
    background.classList.add("apexstock-text-background");

    // Create initial text element
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", y - this.textStyle.padding);
    text.setAttribute("fill", this.textStyle.color);
    text.setAttribute("font-family", this.textStyle.fontFamily);
    text.setAttribute("font-size", `${this.textStyle.fontSize}px`);
    text.setAttribute("font-weight", this.textStyle.fontWeight);
    text.setAttribute("font-style", this.textStyle.fontStyle);
    text.setAttribute("text-decoration", this.textStyle.textDecoration);
    text.setAttribute("text-anchor", "start");
    text.setAttribute("dominant-baseline", "text-before-edge");
    text.classList.add("apexstock-text-content");

    // Add elements to group
    group.appendChild(background);
    group.appendChild(text);

    // Prepare data object
    const textData = {
      type: "text",
      x: dataPoint.x,
      y: dataPoint.y,
      text: "",
      ...this.textStyle,
    };

    // Store references for editing
    this.currentTextElement = group;
    this.currentTextData = textData;

    // Start inline editing
    this.startInlineEditing(group, x, y);

    return {
      element: group,
      data: textData,
    };
  }

  /**
   * Starts inline editing for a text annotation
   * @param {SVGElement} textElement - The text annotation element
   * @param {number} x - Screen x coordinate
   * @param {number} y - Screen y coordinate
   */
  startInlineEditing(textElement, x, y) {
    if (this.isEditing) {
      this.finishEditing();
    }

    this.isEditing = true;

    // Create editable div for inline editing
    const editor = document.createElement("div");
    editor.className = "apexstock-text-editor";
    editor.contentEditable = true;
    editor.style.position = "absolute";
    editor.style.left = `${x}px`;
    editor.style.top = `${
      y - this.textStyle.fontSize - this.textStyle.padding
    }px`;
    editor.style.minWidth = "100px";
    editor.style.minHeight = `${this.textStyle.fontSize}px`;
    editor.style.padding = `${this.textStyle.padding}px`;
    editor.style.background = "white";
    editor.style.border = "1px solid #007bff";
    editor.style.borderRadius = "3px";
    editor.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.1)";
    editor.style.fontFamily = this.textStyle.fontFamily;
    editor.style.fontSize = `${this.textStyle.fontSize}px`;
    editor.style.fontWeight = this.textStyle.fontWeight;
    editor.style.fontStyle = this.textStyle.fontStyle;
    editor.style.textDecoration = this.textStyle.textDecoration;
    editor.style.color = this.textStyle.color;
    editor.style.zIndex = "1000";
    editor.style.overflow = "hidden";
    editor.style.whiteSpace = "pre-wrap";

    // Save reference to the editor
    this.currentTextEditor = editor;

    // Add editor to the DOM
    document.body.appendChild(editor);

    // Focus the editor and ensure cursor is visible
    setTimeout(() => {
      editor.focus();
      // Place cursor at the end
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      // Show the formatting toolbar
      this.showTextToolbar(x, y - this.textStyle.fontSize - 40);
    }, 10);

    // Handle keyboard events
    editor.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        // Cancel editing
        this.cancelEditing();
        e.preventDefault();
      } else if (e.key === "Enter" && !e.shiftKey) {
        // Finish editing
        this.finishEditing();
        e.preventDefault();
      }
    });

    // Handle click outside to finish editing
    const clickOutsideHandler = (e) => {
      if (
        e.target !== editor &&
        !editor.contains(e.target) &&
        !this.toolbarElement.contains(e.target)
      ) {
        this.finishEditing();
        document.removeEventListener("mousedown", clickOutsideHandler);
      }
    };

    document.addEventListener("mousedown", clickOutsideHandler);
  }

  /**
   * Creates the text formatting toolbar
   */
  createTextToolbar() {
    const toolbar = document.createElement("div");
    toolbar.className = "apexstock-text-toolbar";
    toolbar.style.position = "absolute";
    toolbar.style.display = "none";
    toolbar.style.background = "#f8f9fa";
    toolbar.style.border = "1px solid #dee2e6";
    toolbar.style.borderRadius = "4px";
    toolbar.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.1)";
    toolbar.style.padding = "5px";
    toolbar.style.zIndex = "1001";

    // Font size control
    const fontSizeSelect = document.createElement("select");
    fontSizeSelect.className = "apexstock-text-fontsize";
    fontSizeSelect.title = "Font Size";
    [10, 12, 14, 16, 18, 20, 24, 28, 32].forEach((size) => {
      const option = document.createElement("option");
      option.value = size;
      option.textContent = `${size}px`;
      if (size === this.textStyle.fontSize) {
        option.selected = true;
      }
      fontSizeSelect.appendChild(option);
    });
    fontSizeSelect.addEventListener("change", () => {
      this.updateTextStyle("fontSize", parseInt(fontSizeSelect.value));
    });

    // Font family control
    const fontFamilySelect = document.createElement("select");
    fontFamilySelect.className = "apexstock-text-fontfamily";
    fontFamilySelect.title = "Font Family";
    [
      "Arial, sans-serif",
      "Times New Roman, serif",
      "Courier New, monospace",
      "Georgia, serif",
      "Verdana, sans-serif",
    ].forEach((family) => {
      const option = document.createElement("option");
      option.value = family;
      option.textContent = family.split(",")[0];
      if (family === this.textStyle.fontFamily) {
        option.selected = true;
      }
      fontFamilySelect.appendChild(option);
    });
    fontFamilySelect.addEventListener("change", () => {
      this.updateTextStyle("fontFamily", fontFamilySelect.value);
    });

    // Bold button
    const boldButton = document.createElement("button");
    boldButton.className = "apexstock-text-bold";
    boldButton.innerHTML = "<strong>B</strong>";
    boldButton.title = "Bold";
    boldButton.addEventListener("click", () => {
      const newWeight =
        this.textStyle.fontWeight === "bold" ? "normal" : "bold";
      this.updateTextStyle("fontWeight", newWeight);
      boldButton.classList.toggle("active", newWeight === "bold");
    });

    // Italic button
    const italicButton = document.createElement("button");
    italicButton.className = "apexstock-text-italic";
    italicButton.innerHTML = "<em>I</em>";
    italicButton.title = "Italic";
    italicButton.addEventListener("click", () => {
      const newStyle =
        this.textStyle.fontStyle === "italic" ? "normal" : "italic";
      this.updateTextStyle("fontStyle", newStyle);
      italicButton.classList.toggle("active", newStyle === "italic");
    });

    // Underline button
    const underlineButton = document.createElement("button");
    underlineButton.className = "apexstock-text-underline";
    underlineButton.innerHTML = "<u>U</u>";
    underlineButton.title = "Underline";
    underlineButton.addEventListener("click", () => {
      const newDecoration =
        this.textStyle.textDecoration === "underline" ? "none" : "underline";
      this.updateTextStyle("textDecoration", newDecoration);
      underlineButton.classList.toggle("active", newDecoration === "underline");
    });

    // Background opacity control
    const opacityLabel = document.createElement("span");
    opacityLabel.textContent = "BG:";
    opacityLabel.style.marginLeft = "5px";

    const opacitySelect = document.createElement("select");
    opacitySelect.className = "apexstock-text-opacity";
    opacitySelect.title = "Background Opacity";
    [0, 0.3, 0.5, 0.7, 0.9].forEach((opacity) => {
      const option = document.createElement("option");
      option.value = opacity;
      option.textContent = `${opacity * 100}%`;
      if (opacity === this.textStyle.backgroundOpacity) {
        option.selected = true;
      }
      opacitySelect.appendChild(option);
    });
    opacitySelect.addEventListener("change", () => {
      this.updateTextStyle(
        "backgroundOpacity",
        parseFloat(opacitySelect.value)
      );
    });

    // Apply button
    const applyButton = document.createElement("button");
    applyButton.className = "apexstock-text-apply";
    applyButton.textContent = "✓";
    applyButton.title = "Apply (Enter)";
    applyButton.addEventListener("click", () => {
      this.finishEditing();
    });

    // Cancel button
    const cancelButton = document.createElement("button");
    cancelButton.className = "apexstock-text-cancel";
    cancelButton.textContent = "✕";
    cancelButton.title = "Cancel (Esc)";
    cancelButton.addEventListener("click", () => {
      this.cancelEditing();
    });

    // Add all controls to the toolbar
    toolbar.appendChild(fontSizeSelect);
    toolbar.appendChild(fontFamilySelect);
    toolbar.appendChild(boldButton);
    toolbar.appendChild(italicButton);
    toolbar.appendChild(underlineButton);
    toolbar.appendChild(opacityLabel);
    toolbar.appendChild(opacitySelect);
    toolbar.appendChild(applyButton);
    toolbar.appendChild(cancelButton);

    // Style the toolbar controls
    const buttons = toolbar.querySelectorAll("button");
    buttons.forEach((button) => {
      button.style.width = "28px";
      button.style.height = "28px";
      button.style.margin = "0 2px";
      button.style.background = "#fff";
      button.style.border = "1px solid #ced4da";
      button.style.borderRadius = "4px";
      button.style.cursor = "pointer";
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

    document.body.appendChild(toolbar);
    this.toolbarElement = toolbar;
  }

  /**
   * Shows the text formatting toolbar at the specified position
   * @param {number} x - Screen x coordinate
   * @param {number} y - Screen y coordinate
   */
  showTextToolbar(x, y) {
    if (!this.toolbarElement) return;

    this.toolbarElement.style.left = `${x}px`;
    this.toolbarElement.style.top = `${y}px`;
    this.toolbarElement.style.display = "flex";

    // Update active states based on current style
    const boldButton = this.toolbarElement.querySelector(
      ".apexstock-text-bold"
    );
    if (boldButton) {
      boldButton.classList.toggle(
        "active",
        this.textStyle.fontWeight === "bold"
      );
    }

    const italicButton = this.toolbarElement.querySelector(
      ".apexstock-text-italic"
    );
    if (italicButton) {
      italicButton.classList.toggle(
        "active",
        this.textStyle.fontStyle === "italic"
      );
    }

    const underlineButton = this.toolbarElement.querySelector(
      ".apexstock-text-underline"
    );
    if (underlineButton) {
      underlineButton.classList.toggle(
        "active",
        this.textStyle.textDecoration === "underline"
      );
    }
  }

  /**
   * Hides the text formatting toolbar
   */
  hideTextToolbar() {
    if (this.toolbarElement) {
      this.toolbarElement.style.display = "none";
    }
  }

  /**
   * Updates a text style property and applies it to the editor
   * @param {string} property - The style property to update
   * @param {any} value - The new value
   */
  updateTextStyle(property, value) {
    this.textStyle[property] = value;

    if (!this.currentTextEditor) return;

    // Apply the style to the editor
    switch (property) {
      case "fontSize":
        this.currentTextEditor.style.fontSize = `${value}px`;
        break;
      case "fontFamily":
        this.currentTextEditor.style.fontFamily = value;
        break;
      case "fontWeight":
        this.currentTextEditor.style.fontWeight = value;
        break;
      case "fontStyle":
        this.currentTextEditor.style.fontStyle = value;
        break;
      case "textDecoration":
        this.currentTextEditor.style.textDecoration = value;
        break;
      case "color":
        this.currentTextEditor.style.color = value;
        break;
      case "backgroundColor":
        this.currentTextEditor.style.backgroundColor = value;
        break;
      case "backgroundOpacity":
        // This affects the SVG element, not the editor
        break;
    }
  }

  /**
   * Finishes text editing and applies the changes
   */
  finishEditing() {
    if (
      !this.isEditing ||
      !this.currentTextEditor ||
      !this.currentTextElement ||
      !this.currentTextData
    ) {
      return;
    }

    const text = this.currentTextEditor.innerText.trim();

    if (text === "") {
      // If no text entered, cancel editing
      this.cancelEditing();
      return;
    }

    // Update the text element with the edited content
    const svgText = this.currentTextElement.querySelector(
      ".apexstock-text-content"
    );
    if (svgText) {
      // Clear existing content
      while (svgText.firstChild) {
        svgText.removeChild(svgText.firstChild);
      }

      // Split text by lines and create tspan elements
      const lines = text.split("\n");
      lines.forEach((line, index) => {
        const tspan = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "tspan"
        );
        tspan.textContent = line;
        tspan.setAttribute("x", svgText.getAttribute("x"));
        tspan.setAttribute("dy", index === 0 ? "0" : "1.2em");
        svgText.appendChild(tspan);
      });

      // Apply current text style to SVG text
      svgText.setAttribute("font-family", this.textStyle.fontFamily);
      svgText.setAttribute("font-size", `${this.textStyle.fontSize}px`);
      svgText.setAttribute("font-weight", this.textStyle.fontWeight);
      svgText.setAttribute("font-style", this.textStyle.fontStyle);
      svgText.setAttribute("text-decoration", this.textStyle.textDecoration);
      svgText.setAttribute("fill", this.textStyle.color);

      // Update the background
      const background = this.currentTextElement.querySelector(
        ".apexstock-text-background"
      );
      if (background) {
        const svgRect = svgText.getBBox();
        background.setAttribute("x", svgRect.x - this.textStyle.padding);
        background.setAttribute("y", svgRect.y - this.textStyle.padding);
        background.setAttribute(
          "width",
          svgRect.width + this.textStyle.padding * 2
        );
        background.setAttribute(
          "height",
          svgRect.height + this.textStyle.padding * 2
        );
        background.setAttribute(
          "fill-opacity",
          this.textStyle.backgroundOpacity
        );
      }

      // Update data model
      this.currentTextData.text = text;
      Object.assign(this.currentTextData, this.textStyle);

      // Callback to parent component
      if (typeof this.onTextCreated === "function") {
        this.onTextCreated(this.currentTextElement, this.currentTextData);
      }
    }

    // Clean up
    this.cleanupEditing();
  }

  /**
   * Cancels text editing and removes the text element
   */
  cancelEditing() {
    if (!this.isEditing) {
      return;
    }

    if (this.currentTextElement && this.currentTextElement.parentNode) {
      this.currentTextElement.parentNode.removeChild(this.currentTextElement);
    }

    this.cleanupEditing();
  }

  /**
   * Cleans up after editing (removes editor and hides toolbar)
   */
  cleanupEditing() {
    if (this.currentTextEditor && this.currentTextEditor.parentNode) {
      this.currentTextEditor.parentNode.removeChild(this.currentTextEditor);
    }

    this.hideTextToolbar();

    this.currentTextEditor = null;
    this.currentTextElement = null;
    this.currentTextData = null;
    this.isEditing = false;
  }

  /**
   * Edits an existing text annotation
   * @param {SVGElement} textElement - The text annotation element
   * @param {Object} textData - The text annotation data
   */
  editExistingText(textElement, textData) {
    if (this.isEditing) {
      this.finishEditing();
    }

    // Store references
    this.currentTextElement = textElement;
    this.currentTextData = textData;

    // Load style from data
    this.textStyle = {
      fontSize: textData.fontSize,
      fontFamily: textData.fontFamily,
      fontWeight: textData.fontWeight,
      fontStyle: textData.fontStyle,
      textDecoration: textData.textDecoration,
      color: textData.color,
      backgroundColor: textData.backgroundColor,
      backgroundOpacity: textData.backgroundOpacity,
      padding: textData.padding || 5,
    };

    // Get text position
    const svgText = textElement.querySelector(".apexstock-text-content");
    if (svgText) {
      const textX = parseFloat(svgText.getAttribute("x"));
      const textY = parseFloat(svgText.getAttribute("y"));

      // Start editing
      this.startInlineEditing(
        textElement,
        textX,
        textY + this.textStyle.padding
      );

      // Set editor content from text data
      if (this.currentTextEditor) {
        this.currentTextEditor.innerText = textData.text;
      }
    }
  }

  /**
   * Redraws a text annotation element based on its data
   * @param {Object} data - The text annotation data
   * @returns {SVGElement} - The redrawn text element
   */
  redrawTextElement(data) {
    // Create group for the text annotation
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("apexstock-text-annotation");

    // Get screen coordinates
    const textPosition = this.coordinateConverter.dataToScreen(data.x, data.y);

    // Create text element
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", textPosition.x);
    text.setAttribute("y", textPosition.y);
    text.setAttribute("fill", data.color);
    text.setAttribute("font-family", data.fontFamily);
    text.setAttribute("font-size", `${data.fontSize}px`);
    text.setAttribute("font-weight", data.fontWeight);
    text.setAttribute("font-style", data.fontStyle);
    text.setAttribute("text-decoration", data.textDecoration);
    text.setAttribute("text-anchor", "start");
    text.setAttribute("dominant-baseline", "text-before-edge");
    text.classList.add("apexstock-text-content");

    // Split text by lines and create tspan elements
    const lines = data.text.split("\n");
    lines.forEach((line, index) => {
      const tspan = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "tspan"
      );
      tspan.textContent = line;
      tspan.setAttribute("x", textPosition.x);
      tspan.setAttribute("dy", index === 0 ? "0" : "1.2em");
      text.appendChild(tspan);
    });

    // Create background rectangle
    const background = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );

    // Add to group first so we can calculate bounding box
    group.appendChild(text);
    this.svgOverlay.appendChild(group);

    // Calculate background size based on text
    const svgRect = text.getBBox();
    const padding = data.padding || 5;

    background.setAttribute("x", svgRect.x - padding);
    background.setAttribute("y", svgRect.y - padding);
    background.setAttribute("width", svgRect.width + padding * 2);
    background.setAttribute("height", svgRect.height + padding * 2);
    background.setAttribute("fill", data.backgroundColor || "white");
    background.setAttribute("fill-opacity", data.backgroundOpacity);
    background.setAttribute("rx", "3");
    background.classList.add("apexstock-text-background");

    // Remove from current parent and rebuild group in correct order
    this.svgOverlay.removeChild(group);

    // Add elements to group (background first, then text)
    group.appendChild(background);
    group.appendChild(text);

    // Add double-click to edit
    group.addEventListener("dblclick", () => {
      this.editExistingText(group, data);
    });

    return group;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.finishEditing();

    if (this.toolbarElement && this.toolbarElement.parentNode) {
      this.toolbarElement.parentNode.removeChild(this.toolbarElement);
    }
  }
}

export default TextAnnotationManager;
