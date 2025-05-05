export default class SettingsControl {
  /**
   * Creates a reusable settings control box
   * @param {HTMLElement} container - The container element where the control will be placed
   * @param {Object} options - Configuration options
   * @param {string} options.title - Title of the settings box
   * @param {Array} options.controls - Array of control objects
   * @param {Function} options.onChange - Callback function when settings change
   * @param {string} options.position - Position of the box (default: 'top-left')
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      title: options.title || "Settings",
      controls: options.controls || [],
      onChange: options.onChange || (() => {}),
      position: options.position || "top-left",
      theme: options.theme || "light",
    };

    this.element = null;
    this.isVisible = false;
    this.controlElements = {};

    this.create();
  }

  /**
   * Creates the settings control UI
   */
  create() {
    this.element = document.createElement("div");
    this.element.className = "apexstock-settings-control";
    this.element.classList.add(`position-${this.options.position}`);
    if (this.options.theme === "dark") {
      this.element.classList.add("apexstock-theme-dark");
    }

    // Create content area
    const content = document.createElement("div");
    content.className = "apexstock-settings-content";

    // Create controls
    this.options.controls.forEach((control) => {
      const controlGroup = this.createControl(control);
      content.appendChild(controlGroup);
    });

    this.element.appendChild(content);
    this.container.appendChild(this.element);

    // Initially hidden
    this.hide();
  }

  /**
   * Creates a single control based on type
   * @param {Object} control - Control configuration
   * @returns {HTMLElement} - Control element
   */
  createControl(control) {
    const controlGroup = document.createElement("div");
    controlGroup.className = "apexstock-settings-control-group";

    const label = document.createElement("label");
    label.textContent = control.label;
    label.htmlFor = control.id;
    controlGroup.appendChild(label);

    let input;

    switch (control.type) {
      case "range":
        input = this.createRangeControl(control);
        break;
      case "select":
        input = this.createSelectControl(control);
        break;
      case "number":
        input = this.createNumberControl(control);
        break;
      case "color":
        input = this.createColorControl(control);
        break;
      case "toggle":
        input = this.createToggleControl(control);
        break;
      default:
        input = this.createTextControl(control);
    }

    controlGroup.appendChild(input);
    this.controlElements[control.id] = input;

    // Add help text if provided
    if (control.helpText) {
      const helpText = document.createElement("small");
      helpText.className = "apexstock-settings-help";
      helpText.textContent = control.helpText;
      controlGroup.appendChild(helpText);
    }

    return controlGroup;
  }

  /**
   * Creates a range input control
   */
  createRangeControl(control) {
    const container = document.createElement("div");
    container.className = "apexstock-settings-range-container";

    const input = document.createElement("input");
    input.type = "range";
    input.id = control.id;
    input.min = control.min || 0;
    input.max = control.max || 100;
    input.step = control.step || 1;
    input.value = control.value || control.defaultValue || 0;

    const valueDisplay = document.createElement("span");
    valueDisplay.className = "apexstock-settings-range-value";
    valueDisplay.textContent = input.value;

    input.addEventListener("input", (e) => {
      valueDisplay.textContent = e.target.value;
      this.onChange(control.id, parseFloat(e.target.value));
    });

    container.appendChild(input);
    container.appendChild(valueDisplay);

    return container;
  }

  /**
   * Creates a select dropdown control
   */
  createSelectControl(control) {
    const select = document.createElement("select");
    select.id = control.id;

    control.options.forEach((option) => {
      const optElement = document.createElement("option");
      optElement.value = option.value;
      optElement.textContent = option.label;
      if (option.selected) {
        optElement.selected = true;
      }
      select.appendChild(optElement);
    });

    select.addEventListener("change", (e) => {
      this.onChange(control.id, e.target.value);
    });

    return select;
  }

  /**
   * Creates a number input control
   */
  createNumberControl(control) {
    const input = document.createElement("input");
    input.type = "number";
    input.id = control.id;
    input.min = control.min;
    input.max = control.max;
    input.step = control.step || 0.01;
    input.value = control.value || control.defaultValue || 0;

    input.addEventListener("change", (e) => {
      this.onChange(control.id, parseFloat(e.target.value));
    });

    return input;
  }

  /**
   * Creates a color picker control
   */
  createColorControl(control) {
    const input = document.createElement("input");
    input.type = "color";
    input.id = control.id;
    input.value = control.value || control.defaultValue || "#000000";

    input.addEventListener("change", (e) => {
      this.onChange(control.id, e.target.value);
    });

    return input;
  }

  /**
   * Creates a toggle control
   */
  createToggleControl(control) {
    const label = document.createElement("label");
    label.className = "apexstock-settings-toggle";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = control.id;
    input.checked = control.value || control.defaultValue || false;

    const slider = document.createElement("span");
    slider.className = "apexstock-settings-toggle-slider";

    input.addEventListener("change", (e) => {
      this.onChange(control.id, e.target.checked);
    });

    label.appendChild(input);
    label.appendChild(slider);

    return label;
  }

  /**
   * Creates a text input control
   */
  createTextControl(control) {
    const input = document.createElement("input");
    input.type = "text";
    input.id = control.id;
    input.value = control.value || control.defaultValue || "";

    input.addEventListener("change", (e) => {
      this.onChange(control.id, e.target.value);
    });

    return input;
  }

  /**
   * Handles change events and notifies listeners
   */
  onChange(controlId, value) {
    this.options.onChange(controlId, value);
  }

  /**
   * Shows the settings control
   */
  show() {
    this.isVisible = true;
    this.element.style.display = "block";
  }

  /**
   * Hides the settings control
   */
  hide() {
    this.isVisible = false;
    this.element.style.display = "none";
  }

  /**
   * Updates a control value
   * @param {string} controlId - ID of the control
   * @param {any} value - New value
   */
  updateControl(controlId, value) {
    const control = this.controlElements[controlId];
    if (control) {
      if (control.type === "checkbox") {
        control.checked = value;
      } else {
        control.value = value;
      }

      // Update range value display if it's a range control
      if (
        control.nextElementSibling?.classList.contains(
          "apexstock-settings-range-value"
        )
      ) {
        control.nextElementSibling.textContent = value;
      }
    }
  }

  /**
   * Gets current value of a control
   * @param {string} controlId - ID of the control
   * @returns {any} - Current value
   */
  getValue(controlId) {
    const control = this.controlElements[controlId];
    if (control) {
      if (control.type === "checkbox") {
        return control.checked;
      } else if (control.type === "number" || control.type === "range") {
        return parseFloat(control.value);
      } else {
        return control.value;
      }
    }
    return null;
  }

  /**
   * Updates the theme of the control
   * @param {string} theme - 'light' or 'dark'
   */
  updateTheme(theme) {
    this.options.theme = theme;
    if (theme === "dark") {
      this.element.classList.add("apexstock-theme-dark");
    } else {
      this.element.classList.remove("apexstock-theme-dark");
    }
  }

  /**
   * Destroys the settings control
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
