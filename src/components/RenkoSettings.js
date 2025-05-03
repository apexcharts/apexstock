/**
 * RenkoSettings component for ApexStock
 * Provides controls for adjusting Renko chart settings
 */
export default class RenkoSettings {
  /**
   * Creates a new RenkoSettings instance
   * @param {ChartSwitch} chartSwitch - The ChartSwitch instance
   * @param {HTMLElement} container - The container element to append settings to
   */
  constructor(chartSwitch, container) {
    this.chartSwitch = chartSwitch;
    this.container = container;
    this.settingsPanel = null;

    this.createSettingsPanel();
  }

  /**
   * Creates the settings panel
   */
  createSettingsPanel() {
    // Create settings panel container
    this.settingsPanel = document.createElement("div");
    this.settingsPanel.className = "apexstock-renko-settings";
    this.settingsPanel.style.display = "none";

    // Create brick size control
    const brickSizeContainer = document.createElement("div");
    brickSizeContainer.className = "apexstock-renko-brick-size";

    const brickSizeLabel = document.createElement("label");
    brickSizeLabel.textContent = "Brick Size (%)";
    brickSizeLabel.setAttribute("for", "renko-brick-size");

    const brickSizeInput = document.createElement("input");
    brickSizeInput.type = "number";
    brickSizeInput.id = "renko-brick-size";
    brickSizeInput.min = "0.05";
    brickSizeInput.max = "10";
    brickSizeInput.step = "0.1";
    brickSizeInput.value = this.chartSwitch.renkoBrickSize.toString();

    // Create apply button
    const applyButton = document.createElement("button");
    applyButton.className = "apexstock-renko-apply";
    applyButton.textContent = "Apply";

    // Add event listener to update chart
    applyButton.addEventListener("click", () => {
      const newBrickSize = parseFloat(brickSizeInput.value);
      if (!isNaN(newBrickSize) && newBrickSize > 0) {
        this.chartSwitch.renkoBrickSize = newBrickSize;
        // Re-apply Renko chart type to update the chart
        if (this.chartSwitch.currentType === "renko") {
          this.chartSwitch.changeChartType("renko");
        }
      }
    });

    // Assemble the panel
    brickSizeContainer.appendChild(brickSizeLabel);
    brickSizeContainer.appendChild(brickSizeInput);
    brickSizeContainer.appendChild(applyButton);

    this.settingsPanel.appendChild(brickSizeContainer);

    // Add information text
    const infoText = document.createElement("div");
    infoText.className = "apexstock-renko-info";
    infoText.textContent =
      "Brick size is the percentage of price movement required to draw a new brick.";
    this.settingsPanel.appendChild(infoText);

    // Add to container
    this.container.appendChild(this.settingsPanel);
  }

  /**
   * Shows the settings panel
   */
  show() {
    if (this.settingsPanel) {
      this.settingsPanel.style.display = "block";
    }
  }

  /**
   * Hides the settings panel
   */
  hide() {
    if (this.settingsPanel) {
      this.settingsPanel.style.display = "none";
    }
  }

  /**
   * Toggle the settings panel
   */
  toggle() {
    if (this.settingsPanel) {
      if (this.settingsPanel.style.display === "none") {
        this.show();
      } else {
        this.hide();
      }
    }
  }
}
