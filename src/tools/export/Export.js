import Utils from "../../utils/Utils";
/**
 * ApexStock Chart Export Functionality
 * This module adds a screenshot/export capability to ApexStock charts
 * Uses SVG serialization for high-quality chart captures
 */

export default class Export {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.chartEl = ctx.chartEl;
    this.options = {
      filename: "apexstock-chart",
      quality: 1,
      scale: 1, // Higher scale for better resolution
      button: true, // set false for a headless (programmatic-only) instance
      ...options,
    };

    if (this.options.button) this.init();
  }

  init() {
    // Create and append the export button
    this.createExportButton();

    // Add event listener
    this.addButtonEventListener();
  }

  createExportButton() {
    // Create button container
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "apexstock-export-btn-container";

    // Create button
    const exportButton = document.createElement("button");
    exportButton.className = "apexstock-export-btn";
    exportButton.title = "Download Chart as PNG";

    // Add download icon (SVG)
    exportButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;

    // Append to container
    buttonContainer.appendChild(exportButton);
    this.ctx.primaryToolbarRight.appendChild(buttonContainer);

    // Store references
    this.exportButton = exportButton;
    this.buttonContainer = buttonContainer;
  }

  /** The download-arrow icon markup (idle button state). */
  _idleIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;
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

      const reset = () => {
        this.buttonContainer.style.display = "block";
        this.exportButton.disabled = false;
        this.exportButton.innerHTML = this._idleIcon();
      };

      // Hide the export button temporarily for a clean capture. A short delay
      // lets any in-flight animation settle before serialization.
      this.buttonContainer.style.display = "none";
      setTimeout(() => {
        this.capture({ format: "png", download: true })
          .then((res) => {
            reset();
            if (res && res.fallback) {
              this.showNotification(
                "PNG isn't supported in this browser; downloaded an SVG instead.",
                "info"
              );
            }
          })
          .catch((error) => {
            Utils.error("Error capturing chart:", error);
            reset();
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

      // any styles that need to be attached with the exported svg
      const exportStyles = `
        .apexcharts-tooltip, .apexcharts-toolbar, .apexcharts-xaxistooltip, .apexcharts-yaxistooltip, .apexcharts-xcrosshairs, .apexcharts-ycrosshairs, .apexcharts-zoom-rect, .apexcharts-selection-rect, .apexstock-text-toolbar, .apexstock-zoom-controls, .apexstock-settings-control {
          display: none !important;
        }
        .apexcharts-custom-tooltip, .apexcharts-tooltip-box {
          padding: 4px 8px;
        }
        .apexcharts-tooltip-box>div {
          margin: 4px 0;
        }
        .apexcharts-tooltip-box span.value {
          font-weight: 700;
        }
        .apexstock-drawing-overlay-wrapper {
            position: absolute;
            top: 0;
        }
        .apexstock-drawing-overlay {
          overflow: auto;
          width: 100%;
          height: 100%;
        }
        [class^=apexstock-] * {
          font-family: ${
            this.ctx.chartOptions.chart.fontFamily ||
            "Helvetica, Arial, sans-serif"
          }
        }
      `;

      // Create SVG with foreignObject
      let svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" 
          version="1.1" 
          xmlns:xlink="http://www.w3.org/1999/xlink" 
          class="apexstock-svg" 
          xmlns:data="ApexStockNS" 
          transform="translate(0, 0)" 
          width="${width}px" height="${height + this.ctx.xAxisHeight}px">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="width:${scaledWidth}px; height:${scaledHeight}px;">
              <style type="text/css">
                ${exportStyles}
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
            Utils.error("Error converting image to base64:", error);
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
   * Capture the chart as an image.
   *
   * SVG is always available (a serialized snapshot of the chart DOM). PNG is
   * produced by rasterizing that SVG onto a canvas; some browsers refuse to
   * rasterize `<foreignObject>` content (a security restriction) and taint the
   * canvas, in which case this transparently falls back to SVG and flags it via
   * `fallback: true` on the result.
   *
   * @param {{format?: "png"|"svg", scale?: number, download?: boolean, filename?: string}} [options]
   * @returns {Promise<{format:"png"|"svg", blob: Blob, url: string, fallback?: boolean}>}
   */
  capture(options = {}) {
    const format = (options.format || "png").toLowerCase() === "svg"
      ? "svg"
      : "png";
    const scale = options.scale || this.options.scale || 1;
    const download = !!options.download;
    const baseName = options.filename || this.options.filename;

    const asSvg = (svgString, fallback) => {
      const blob = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      if (download) this._triggerDownload(url, this._withExt(baseName, "svg"));
      const res = { format: "svg", blob, url };
      if (fallback) res.fallback = true;
      return res;
    };

    if (format === "svg") {
      return this.getSvgString(scale).then((svg) => asSvg(svg, false));
    }

    // PNG: composite the native ApexCharts raster (main chart + oscillator
    // panes). These are pure SVG (no <foreignObject>), so the canvas is not
    // tainted and a real PNG comes out. Fall back to SVG if anything fails
    // (e.g. an older ApexCharts without dataURI).
    return this.rasterize(scale)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (download) this._triggerDownload(url, this._withExt(baseName, "png"));
        return { format: "png", blob, url };
      })
      .catch((err) => {
        Utils.warn(
          "PNG export unavailable, falling back to SVG:",
          err && err.message
        );
        return this.getSvgString(scale).then((svg) => asSvg(svg, true));
      });
  }

  /**
   * Produce a PNG Blob by compositing the main chart and any oscillator panes,
   * stacked vertically, using each ApexCharts instance's native `dataURI()`.
   * @param {number} scale
   * @returns {Promise<Blob>}
   */
  rasterize(scale) {
    const charts = [
      this.ctx.chart,
      ...Object.values(this.ctx.indicatorChartMap || {}),
    ].filter((c) => c && typeof c.dataURI === "function");
    if (!charts.length) {
      return Promise.reject(new Error("dataURI() is unavailable"));
    }
    return Promise.all(
      charts.map((c) =>
        Promise.resolve(c.dataURI({ scale })).then((r) =>
          r && r.imgURI ? r.imgURI : null
        )
      )
    ).then((uris) => {
      const valid = uris.filter(Boolean);
      if (!valid.length) throw new Error("no rasterizable chart panes");
      return this._composite(valid);
    });
  }

  /** Load an image source into an <img>, resolving once decoded. */
  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = src;
    });
  }

  /** Stack PNG data URLs vertically onto one canvas and return a PNG Blob. */
  _composite(dataUrls) {
    return Promise.all(dataUrls.map((u) => this._loadImage(u))).then((imgs) => {
      const width = Math.max(...imgs.map((i) => i.width || 0), 1);
      const height = Math.max(
        imgs.reduce((sum, i) => sum + (i.height || 0), 0),
        1
      );
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const c2d = canvas.getContext("2d");
      c2d.fillStyle = this._backgroundColor();
      c2d.fillRect(0, 0, width, height);
      let y = 0;
      for (const img of imgs) {
        c2d.drawImage(img, 0, y);
        y += img.height || 0;
      }
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null")),
          "image/png",
          this.options.quality
        );
      });
    });
  }

  /** Opaque background color for rasterized PNGs. */
  _backgroundColor() {
    const bg =
      this.chartEl && this.chartEl.style && this.chartEl.style.backgroundColor;
    if (bg) return bg;
    return this.ctx.isDarkTheme ? "#1e1e2d" : "#ffffff";
  }

  /** Swap/append a file extension on the configured filename. */
  _withExt(name, ext) {
    return String(name || "apexstock-chart").replace(/\.\w+$/i, "") + "." + ext;
  }

  /** Trigger a browser download of a URL, then release it. */
  _triggerDownload(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke on the next tick so the download has a chance to start.
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
      border-radius: 3px;
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
}
