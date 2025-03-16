/**
 * ApexStock Chart Export Functionality
 * This module adds a screenshot/export capability to ApexStock charts
 * Uses SVG serialization for high-quality chart captures
 */

export default class Export {
  constructor(chartEl, options = {}) {
    this.chartEl = chartEl;
    this.options = {
      filename: "apexstock-chart.png",
      quality: 1,
      scale: 2, // Higher scale for better resolution
      ...options,
    };

    this.init();
  }

  init() {
    // Create and append the export button
    this.createExportButton();

    // Add event listener
    this.addButtonEventListener();
  }

  createExportButton() {
    const chartContainer = this.chartEl;

    // Create button container
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "apex-export-btn-container";
    buttonContainer.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 100;
    `;

    // Create button
    const exportButton = document.createElement("button");
    exportButton.className = "apex-export-btn";
    exportButton.title = "Download Chart as PNG";
    exportButton.style.cssText = `
      background-color: rgba(255, 255, 255, 0.8);
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
      width: 32px;
      height: 32px;
    `;

    // Add download icon (SVG)
    exportButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;

    // Add hover effect
    exportButton.addEventListener("mouseover", () => {
      exportButton.style.backgroundColor = "rgba(255, 255, 255, 1)";
    });

    exportButton.addEventListener("mouseout", () => {
      exportButton.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
    });

    // Append to container
    buttonContainer.appendChild(exportButton);
    chartContainer.appendChild(buttonContainer);

    // Store references
    this.exportButton = exportButton;
    this.buttonContainer = buttonContainer;
  }

  addButtonEventListener() {
    this.exportButton.addEventListener("click", (e) => {
      e.preventDefault();

      // Change button state to indicate processing
      this.exportButton.disabled = true;
      this.exportButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-dasharray="30" stroke-dashoffset="0">
            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
          </svg>
      `;

      // Hide the export button temporarily for clean capture
      this.buttonContainer.style.display = "none";

      // Wait a moment for any animations to complete
      setTimeout(() => {
        // Get SVG string with foreignObject
        this.getSvgString(this.options.scale)
          .then((svgString) => {
            // Convert SVG to downloadable file
            return this.svgToPng(svgString);
          })
          .then((svgUrl) => {
            // Show the export button again
            this.buttonContainer.style.display = "block";

            // Create download link
            const downloadLink = document.createElement("a");
            downloadLink.href = svgUrl;
            downloadLink.download = this.options.filename.replace(
              /\.png$/i,
              ".svg"
            );
            document.body.appendChild(downloadLink);

            // Trigger download
            downloadLink.click();

            // Clean up
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(svgUrl);

            // Reset button state
            this.exportButton.disabled = false;
            this.exportButton.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            `;
          })
          .catch((error) => {
            console.error("Error capturing chart:", error);

            // Reset button state
            this.buttonContainer.style.display = "block";
            this.exportButton.disabled = false;
            this.exportButton.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            `;

            // Show error notification
            this.showNotification(
              "Failed to capture chart. Please try again.",
              "error"
            );
          });
      }, 100);
    });
  }

  /**
   * Get SVG string representation of the chart
   * @param {number} _scale - Scale factor for the output
   * @returns {Promise<string>} SVG string
   */
  getSvgString(_scale) {
    return new Promise((resolve) => {
      // Get element dimensions
      const rect = this.chartEl.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Apply scale
      const scale = _scale || this.options.scale || 1;
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;

      // Clone the DOM node to avoid modifying the original
      const clonedNode = this.chartEl.cloneNode(true);
      clonedNode.style.width = scaledWidth + "px";
      clonedNode.style.height = scaledHeight + "px";
      const serializedNode = new XMLSerializer().serializeToString(clonedNode);

      // Create SVG with foreignObject
      let svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" 
          version="1.1" 
          xmlns:xlink="http://www.w3.org/1999/xlink" 
          class="apexcharts-svg" 
          xmlns:data="ApexChartsNS" 
          transform="translate(0, 0)" 
          width="${width}px" height="${height}px">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="width:${scaledWidth}px; height:${scaledHeight}px;">
              <style type="text/css">
                .apexcharts-tooltip, .apexcharts-toolbar, .apexcharts-xaxistooltip, .apexcharts-yaxistooltip, .apexcharts-xcrosshairs, .apexcharts-ycrosshairs, .apexcharts-zoom-rect, .apexcharts-selection-rect {
                  display: none;
                }
              </style>
              ${serializedNode}
            </div>
          </foreignObject>
        </svg>
      `;

      // Convert SVG string to node
      const svgNode = this.svgStringToNode(svgString);

      // Scale SVG if necessary
      if (scale !== 1) {
        this.scaleSvgNode(svgNode, scale);
      }

      // Convert all images to base64
      this.convertImagesToBase64(svgNode).then(() => {
        // Get final SVG string
        svgString = new XMLSerializer().serializeToString(svgNode);
        resolve(svgString.replace(/&nbsp;/g, "&#160;"));
      });
    });
  }

  /**
   * Convert SVG string to DOM node
   * @param {string} svgString - SVG as string
   * @returns {Node} SVG DOM node
   */
  svgStringToNode(svgString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    return doc.documentElement;
  }

  /**
   * Scale SVG node
   * @param {Node} svgNode - SVG DOM node
   * @param {number} scale - Scale factor
   */
  scaleSvgNode(svgNode, scale) {
    // Get original dimensions
    const width = parseFloat(svgNode.getAttribute("width"));
    const height = parseFloat(svgNode.getAttribute("height"));

    // Apply scale
    svgNode.setAttribute("width", width * scale + "px");
    svgNode.setAttribute("height", height * scale + "px");

    // Scale viewBox if it exists
    const viewBox = svgNode.getAttribute("viewBox");
    if (viewBox) {
      const viewBoxValues = viewBox.split(" ").map(parseFloat);
      const newViewBox = [
        viewBoxValues[0],
        viewBoxValues[1],
        viewBoxValues[2] * scale,
        viewBoxValues[3] * scale,
      ].join(" ");
      svgNode.setAttribute("viewBox", newViewBox);
    }
  }

  /**
   * Convert all images in SVG to base64
   * @param {Node} svgNode - SVG DOM node
   * @returns {Promise} Promise that resolves when all images are converted
   */
  convertImagesToBase64(svgNode) {
    const images = svgNode.getElementsByTagName("image");
    const promises = Array.from(images).map((img) => {
      const href = img.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      if (href && !href.startsWith("data:")) {
        return this.getBase64FromUrl(href)
          .then((base64) => {
            img.setAttributeNS("http://www.w3.org/1999/xlink", "href", base64);
          })
          .catch((error) => {
            console.error("Error converting image to base64:", error);
          });
      }
      return Promise.resolve();
    });
    return Promise.all(promises);
  }

  /**
   * Convert URL to base64
   * @param {string} url - Image URL
   * @returns {Promise<string>} Promise that resolves with base64 string
   */
  getBase64FromUrl(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL());
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * Convert SVG string to a downloadable file
   * @param {string} svgString - SVG string
   * @returns {Promise<string>} Promise that resolves with download URL
   */
  svgToPng(svgString, scale) {
    return new Promise((resolve, reject) => {
      try {
        // Create a Blob from the SVG string
        const blob = new Blob([svgString], {
          type: "image/svg+xml;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);

        // We'll download as SVG since PNG conversion has security issues
        const filename = this.options.filename.replace(/\.png$/i, ".svg");

        resolve(url);
      } catch (err) {
        reject(err);
      }
    });
  }

  showNotification(message, type = "info") {
    // Create notification element
    const notification = document.createElement("div");
    notification.className = `apex-notification apex-notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 15px;
      background-color: ${type === "error" ? "#f44336" : "#4CAF50"};
      color: white;
      border-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s;
    `;

    // Add to DOM
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.opacity = "1";
    }, 10);

    // Remove after delay
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  // Utility method to set custom filename
  setFilename(filename) {
    this.options.filename = filename;
    return this;
  }

  // Method to update export options
  updateOptions(options) {
    this.options = {
      ...this.options,
      ...options,
    };
    return this;
  }
}
