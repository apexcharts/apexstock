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

    // Clean, consistent monochrome SVG icons (stroke = currentColor, so they
    // adapt to the active theme). Feather/Lucide-style line icons.
    const icon = (paths) =>
      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

    // Define all possible tools
    const allTools = [
      {
        name: "line",
        icon: icon(
          '<line x1="5" y1="19" x2="19" y2="5"/><circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none"/>'
        ),
        tooltip: "Line",
      },
      {
        name: "brush",
        icon: icon('<path d="M3 17c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>'),
        tooltip: "Brush",
      },
      {
        name: "highlighter",
        icon: icon(
          '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'
        ),
        tooltip: "Highlighter",
      },
      {
        name: "rectangle",
        icon: icon('<rect x="3.5" y="5.5" width="17" height="13" rx="2"/>'),
        tooltip: "Rectangle",
      },
      {
        name: "circle",
        icon: icon('<circle cx="12" cy="12" r="8.5"/>'),
        tooltip: "Circle",
      },
      {
        name: "ellipse",
        icon: icon('<ellipse cx="12" cy="12" rx="9" ry="6"/>'),
        tooltip: "Ellipse",
      },
      {
        name: "text",
        icon: icon(
          '<polyline points="5 7 5 5 19 5 19 7"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="9.5" y1="19" x2="14.5" y2="19"/>'
        ),
        tooltip: "Text Annotation",
      },
      {
        name: "pin",
        icon: icon(
          '<line x1="12" y1="17" x2="12" y2="22"/><path d="M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>'
        ),
        tooltip: "Pin Tooltips",
      },
      {
        name: "clear",
        icon: icon(
          '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="16"/><line x1="14" y1="11" x2="14" y2="16"/>'
        ),
        tooltip: "Clear All",
      },
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
      button.innerHTML = tool.icon;
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
