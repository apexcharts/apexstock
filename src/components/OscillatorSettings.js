/**
 * OscillatorSettings.js
 * Manages customizable settings for oscillator indicators
 */

export default class OscillatorSettings {
  /**
   * Creates settings controls for oscillator indicators
   * @param {ApexStock} ctx - The ApexStock context
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.settingsControls = {};
    this.defaultParams = this.getDefaultParams();
    this.indicatorParams = {};

    // Create a dedicated container for settings panels
    this.createSettingsContainer();

    // Initialize with default parameters
    Object.keys(this.defaultParams).forEach((indicator) => {
      this.indicatorParams[indicator] = { ...this.defaultParams[indicator] };
    });
  }

  /**
   * Creates a container for oscillator settings
   */
  createSettingsContainer() {
    this.settingsContainer = document.createElement("div");
    this.settingsContainer.classList.add(
      "apexstock-oscillator-settings-container"
    );
    this.settingsContainer.style.position = "absolute";
    this.settingsContainer.style.top = "0";
    this.settingsContainer.style.left = "0";
    this.settingsContainer.style.width = "100%";
    this.settingsContainer.style.pointerEvents = "none"; // Allow clicks to pass through container
    this.settingsContainer.style.zIndex = "100";

    // Add to chart element
    this.ctx.chartEl.appendChild(this.settingsContainer);
  }

  /**
   * Gets default parameters for each indicator type
   * @returns {Object} Default parameters for all indicator types
   */
  getDefaultParams() {
    return {
      rsi: {
        period: 14,
      },
      macd: {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      },
      volumes: {},
      "price volume trend": {},
      "stochastic oscillator": {
        period: 14,
        smoothPeriod: 3,
      },
      "standard deviation indicator": {
        period: 14,
      },
      "average directional index": {
        period: 14,
      },
      "chaikin oscillator": {
        shortPeriod: 3,
        longPeriod: 10,
      },
      "commodity channel index": {
        period: 20,
      },
      "trend strength index": {
        longPeriod: 25,
        shortPeriod: 13,
        signalPeriod: 7,
      },
      "accelerator oscillator": {
        period: 5,
      },
      "bollinger bands %b": {
        period: 20,
        stdDev: 2,
      },
      "bollinger bands width": {
        period: 20,
        stdDev: 2,
      },
    };
  }

  /**
   * Creates settings control for an indicator
   * @param {string} indicator - The indicator type
   * @param {HTMLElement} container - The indicator container (for positioning reference)
   * @returns {Object} The settings control instance
   */
  createSettingsControl(indicator, container) {
    if (this.settingsControls[indicator]) {
      return this.settingsControls[indicator];
    }

    const params = this.defaultParams[indicator] || {};
    if (Object.keys(params).length === 0) {
      return null; // No configurable parameters for this indicator
    }

    // Find the indicator div inside the container for positioning reference
    const indicatorDiv = Array.from(container.children).find(
      (child) => child.dataset.indicator === indicator
    );

    if (!indicatorDiv) {
      return null;
    }

    // Build controls array based on indicator parameters
    const controls = [];

    Object.keys(params).forEach((param) => {
      controls.push({
        id: param,
        type: "number",
        label: this.formatParamLabel(param),
        value: params[param],
        defaultValue: params[param],
        min: 1,
        max: param.includes("Period") ? 100 : 10,
        step: param === "stdDev" ? 0.1 : 1,
      });
    });

    // Create settings control with minimal UI
    const settingsControl = new this.ctx.SettingsControl(
      this.settingsContainer,
      {
        controls,
        position: "top-left",
        theme: this.ctx.theme,
        onChange: (controlId, value) => {
          if (!this.indicatorParams[indicator]) {
            this.indicatorParams[indicator] = {};
          }

          this.indicatorParams[indicator][controlId] = value;

          // Redraw the indicator with new parameters
          this.updateIndicator(indicator);
        },
      }
    );

    // Position the settings relative to the indicator div
    this.positionSettingsControl(settingsControl, indicatorDiv);

    // Apply custom styling for oscillator settings
    this.applyMinimalStyling(settingsControl);

    // Store the settings control reference
    this.settingsControls[indicator] = {
      control: settingsControl,
      indicatorDiv: indicatorDiv,
    };

    return settingsControl;
  }

  /**
   * Positions a settings control relative to an indicator div
   * @param {Object} settingsControl - The settings control instance
   * @param {HTMLElement} indicatorDiv - The indicator div element
   */
  positionSettingsControl(settingsControl, indicatorDiv) {
    if (!settingsControl || !settingsControl.element || !indicatorDiv) return;

    // Get indicator position
    const indicatorRect = indicatorDiv.getBoundingClientRect();
    const containerRect = this.ctx.chartEl.getBoundingClientRect();

    // Calculate positioning (top-left of indicator with 10px offset)
    const top = indicatorRect.top - containerRect.top + 10;
    const left = indicatorRect.left - containerRect.left + 10;

    // Apply position
    settingsControl.element.style.position = "absolute";
    settingsControl.element.style.top = `${top}px`;
    settingsControl.element.style.left = `${left}px`;
    settingsControl.element.style.pointerEvents = "auto"; // Enable clicks on the settings control
  }

  /**
   * Updates the position of all settings controls
   * Called when chart layout changes
   */
  updatePositions() {
    Object.keys(this.settingsControls).forEach((indicator) => {
      const { control, indicatorDiv } = this.settingsControls[indicator];
      if (control && indicatorDiv) {
        this.positionSettingsControl(control, indicatorDiv);
      }
    });
  }

  /**
   * Formats parameter label for display
   * @param {string} param - The parameter name
   * @returns {string} Formatted label
   */
  formatParamLabel(param) {
    // Convert camelCase to Title Case with spaces
    return param
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());
  }

  /**
   * Applies minimal styling to settings control
   * @param {Object} settingsControl - The settings control instance
   */
  applyMinimalStyling(settingsControl) {
    if (!settingsControl || !settingsControl.element) return;

    const element = settingsControl.element;

    // Apply styles for minimalistic UI
    element.style.opacity = "0.8";
    element.style.transition = "opacity 0.2s ease";
    element.style.padding = "6px 8px";
    element.style.borderRadius = "4px";
    element.style.width = "auto";
    element.style.maxWidth = "100%";
    element.style.fontSize = "11px";
    element.style.backdropFilter = "blur(2px)";

    // Add hover effect for opacity
    element.addEventListener("mouseenter", () => {
      element.style.opacity = "1";
    });

    element.addEventListener("mouseleave", () => {
      element.style.opacity = "0.8";
    });

    // Adjust control group layout for inline display
    const controlGroups = element.querySelectorAll(
      ".apexstock-settings-control-group"
    );
    controlGroups.forEach((group) => {
      group.style.display = "inline-flex";
      group.style.alignItems = "center";
      group.style.marginRight = "10px";
      group.style.marginBottom = "5px";
    });

    // Adjust label and input sizes
    const labels = element.querySelectorAll("label");
    labels.forEach((label) => {
      label.style.marginRight = "5px";
      label.style.marginBottom = "0";
      label.style.minWidth = "auto";
    });

    // Make number inputs smaller
    const inputs = element.querySelectorAll('input[type="number"]');
    inputs.forEach((input) => {
      input.style.width = "50px";
      input.style.margin = "0 0 0 5px";
      input.style.padding = "2px 4px";
    });
  }

  /**
   * Updates the indicator with new parameters
   * @param {string} indicator - The indicator to update
   */
  updateIndicator(indicator) {
    // Remove the existing indicator
    this.ctx.removeIndicator(indicator);

    // Re-add it with the new parameters
    setTimeout(() => {
      // This delay ensures clean removal before re-adding
      this.ctx.updateIndicator(indicator);
    }, 50);
  }

  /**
   * Gets the current parameters for an indicator
   * @param {string} indicator - The indicator type
   * @returns {Object} Current parameters
   */
  getIndicatorParams(indicator) {
    return (
      this.indicatorParams[indicator] || this.defaultParams[indicator] || {}
    );
  }

  /**
   * Updates theme for all settings controls
   * @param {string} theme - The theme ('light' or 'dark')
   */
  updateTheme(theme) {
    Object.keys(this.settingsControls).forEach((indicator) => {
      const { control } = this.settingsControls[indicator];
      if (control && typeof control.updateTheme === "function") {
        control.updateTheme(theme);
      }
    });
  }

  /**
   * Shows settings for the active indicator
   * @param {string} indicator - The indicator type
   */
  showSettings(indicator) {
    if (
      this.settingsControls[indicator] &&
      this.settingsControls[indicator].control
    ) {
      this.settingsControls[indicator].control.show();
    }
  }

  /**
   * Hides settings for an indicator
   * @param {string} indicator - The indicator type
   */
  hideSettings(indicator) {
    if (
      this.settingsControls[indicator] &&
      this.settingsControls[indicator].control
    ) {
      this.settingsControls[indicator].control.hide();
    }
  }

  /**
   * Hides all settings controls
   */
  hideAllSettings() {
    Object.keys(this.settingsControls).forEach((indicator) => {
      this.hideSettings(indicator);
    });
  }

  /**
   * Removes a settings element from the DOM
   * @param {string} indicator - The indicator type
   */
  removeSettingsElement(indicator) {
    if (
      this.settingsControls[indicator] &&
      this.settingsControls[indicator].control
    ) {
      this.settingsControls[indicator].control.destroy();
      delete this.settingsControls[indicator];
    }
  }

  /**
   * Destroys all settings controls and the container
   */
  destroy() {
    Object.keys(this.settingsControls).forEach((indicator) => {
      if (
        this.settingsControls[indicator].control &&
        typeof this.settingsControls[indicator].control.destroy === "function"
      ) {
        this.settingsControls[indicator].control.destroy();
      }
    });

    this.settingsControls = {};

    // Remove the settings container
    if (this.settingsContainer && this.settingsContainer.parentNode) {
      this.settingsContainer.parentNode.removeChild(this.settingsContainer);
    }
  }
}
