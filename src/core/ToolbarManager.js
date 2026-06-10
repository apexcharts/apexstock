// ToolbarManager.js - Manages the drawing toolbar
class ToolbarManager {
  /**
   * @param {HTMLElement} chartDiv - The chart container element
   * @param {string} initialColor - Initial drawing color
   * @param {number} initialWidth - Initial drawing width
   * @param {Function} toolClickHandler - Handler for tool button clicks
   * @param {Function} clearHandler - Handler for clear button clicks
   */
  constructor(
    ctx,
    chartDiv,
    initialColor,
    initialWidth,
    toolClickHandler,
    clearHandler,
    availableTools
  ) {
    this.ctx = ctx;
    this.chartDiv = chartDiv;
    this.drawingColor = initialColor;
    this.drawingWidth = initialWidth;
    this.toolClickHandler = toolClickHandler;
    this.clearHandler = clearHandler;
    this.toolbarContainer = null;
    this.onColorChange = null;
    this.onWidthChange = null;
    this.availableTools = availableTools || {};

    this.createDrawingToolbar();
  }

  /**
   * Creates the drawing toolbar with tools
   */
  createDrawingToolbar() {
    const toolbarContainer = document.createElement("div");
    toolbarContainer.className = "apexstock-drawing-toolbar";
    toolbarContainer.setAttribute("role", "toolbar");
    toolbarContainer.setAttribute("aria-label", "Drawing tools");

    // Define all possible tools
    const allTools = [
      { name: "line", icon: "╱", tooltip: "Line" },
      { name: "brush", icon: "∿", tooltip: "Brush" },
      { name: "highlighter", icon: "🖌️", tooltip: "Highlighter" },
      { name: "rectangle", icon: "▢", tooltip: "Rectangle" },
      { name: "circle", icon: "◯", tooltip: "Circle" },
      { name: "ellipse", icon: "⬭", tooltip: "Ellipse" },
      { name: "text", icon: "T", tooltip: "Text Annotation" },
      { name: "pin", icon: "📌", tooltip: "Pin Tooltips" },
      { name: "clear", icon: "🗑", tooltip: "Clear All" },
    ];

    // Filter tools based on configuration
    const tools = allTools.filter((tool) => {
      // If no configuration exists, show all tools
      if (!this.availableTools) return true;

      return this.availableTools[tool.name] !== false;
    });

    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = this.drawingColor;
    colorPicker.classList.add("apexstock-drawing-color-picker");

    colorPicker.title = "Color";
    colorPicker.setAttribute("aria-label", "Drawing color");
    colorPicker.addEventListener("input", (e) => {
      this.drawingColor = e.target.value;
      if (typeof this.onColorChange === "function") {
        this.onColorChange(e.target.value);
      }
    });
    toolbarContainer.appendChild(colorPicker);

    // Create width selector
    const widthSelector = document.createElement("select");
    widthSelector.style.marginRight = "5px";
    widthSelector.style.height = "30px";
    widthSelector.title = "Line Width";
    widthSelector.setAttribute("aria-label", "Line width");
    [1, 2, 3, 5, 8].forEach((width) => {
      const option = document.createElement("option");
      option.value = width;
      option.textContent = width + "px";
      if (width === this.drawingWidth) {
        option.selected = true;
      }
      widthSelector.appendChild(option);
    });
    widthSelector.addEventListener("change", (e) => {
      this.drawingWidth = parseInt(e.target.value);
      if (typeof this.onWidthChange === "function") {
        this.onWidthChange(parseInt(e.target.value));
      }
    });
    toolbarContainer.appendChild(widthSelector);

    // Create tool buttons for enabled tools
    tools.forEach((tool) => {
      const button = document.createElement("button");
      button.className = "apexstock-drawing-tool";
      button.type = "button";
      button.dataset.tool = tool.name;
      button.textContent = tool.icon;
      button.title = tool.tooltip;
      button.setAttribute("aria-label", tool.tooltip);

      // Add special style for selection tool
      if (tool.name === "select") {
        button.style.backgroundColor = "#f0f0f0";
      }

      // Special styling for pin button
      if (tool.name === "pin") {
        button.classList.add("active"); // Pin is enabled by default
        button.style.marginRight = "2px";
      }

      if (tool.name === "clear") {
        button.style.marginLeft = "2px";
      }

      button.addEventListener("click", () => {
        if (tool.name === "clear") {
          if (typeof this.clearHandler === "function") {
            this.clearHandler();
          }
        } else {
          if (typeof this.toolClickHandler === "function") {
            this.toolClickHandler(tool.name);
          }
        }
      });

      toolbarContainer.appendChild(button);
    });

    this.ctx.primaryToolbarLeft.appendChild(toolbarContainer);
    this.toolbarContainer = toolbarContainer;
  }

  /**
   * Updates the active tool in the toolbar
   * @param {string} toolName - Name of the active tool
   */
  setActiveTool(toolName) {
    if (!this.toolbarContainer) return;

    this.toolbarContainer
      .querySelectorAll(".apexstock-drawing-tool")
      .forEach((btn) => {
        if (btn.dataset.tool === toolName) {
          btn.classList.add("active");
        } else if (["clear", "pin"].indexOf(btn.dataset.tool) === -1) {
          btn.classList.remove("active");
        }
      });
  }

  /**
   * Updates the drawing color
   * @param {string} color - New color value
   */
  setColor(color) {
    this.drawingColor = color;

    const colorPicker = this.toolbarContainer.querySelector(
      ".apexstock-drawing-color-picker"
    );
    if (colorPicker) {
      colorPicker.value = color;
    }
  }

  /**
   * Updates the drawing width
   * @param {number} width - New width value
   */
  setWidth(width) {
    this.drawingWidth = width;

    const widthSelector = this.toolbarContainer.querySelector("select");
    if (widthSelector) {
      for (let i = 0; i < widthSelector.options.length; i++) {
        if (parseInt(widthSelector.options[i].value) === width) {
          widthSelector.selectedIndex = i;
          break;
        }
      }
    }
  }

  /**
   * Removes the toolbar from the DOM
   */
  destroy() {
    if (this.toolbarContainer && this.toolbarContainer.parentNode) {
      this.toolbarContainer.parentNode.removeChild(this.toolbarContainer);
    }
  }
}

export default ToolbarManager;
