/**
 * License Manager for ApexStock
 * Handles license validation and management
 */
export default class LicenseManager {
  static licenseKey = null;
  static validationResult = null;

  /**
   * Decode license data from encoded string
   * This is a simple base64 + JSON approach - you can make it more sophisticated
   */
  static decodeLicenseData(encodedData) {
    try {
      // Simple base64 decode (you might want to add more obfuscation)
      const decodedString = window.atob(encodedData);
      const data = JSON.parse(decodedString);

      // Validate required fields
      if (!data.issueDate || !data.expiryDate || !data.plan) {
        return null;
      }

      return {
        expiryDate: data.expiryDate,
        issueDate: data.issueDate,
        plan: data.plan,
        valid: true,
      };
    } catch {
      return null;
    }
  }

  /**
   * Generate a license key (for your internal use)
   * You would use this on your server/admin panel to generate keys for customers
   */
  static generateLicenseKey(issueDate, expiryDate, plan = "standard") {
    const licenseData = {
      expiryDate,
      issueDate,
      plan,
    };

    const encodedData = window.btoa(JSON.stringify(licenseData));

    return `APEX-${encodedData}`;
  }

  /**
   * Get current license validation result
   */
  static getLicenseStatus() {
    if (!this.licenseKey) {
      return { expired: false, valid: false };
    }

    if (!this.validationResult) {
      this.validationResult = this.validateLicense(this.licenseKey);
    }

    return this.validationResult;
  }

  /**
   * Check if current license is valid
   */
  static isLicenseValid() {
    if (!this.licenseKey) {
      return false;
    }

    if (!this.validationResult) {
      this.validationResult = this.validateLicense(this.licenseKey);
    }

    return this.validationResult.valid;
  }

  /**
   * Set the global license key
   */
  static setLicense(key) {
    this.licenseKey = key;
    this.validationResult = this.validateLicense(key);

    if (!this.validationResult.valid) {
      console.error(`[ApexStock] ${this.validationResult.message}`);
    }
  }

  /**
   * Validate license key format and content
   */
  static validateLicense(key) {
    try {
      // Check basic format
      if (!key.startsWith("APEX-")) {
        return {
          expired: false,
          message:
            'Invalid license key format. License key must start with "APEX-".',
          valid: false,
        };
      }

      // Extract and decode the data part
      const parts = key.split("-");

      if (parts.length !== 2) {
        return {
          expired: false,
          message:
            "Invalid license key format. Expected format: APEX-{encoded-data}.",
          valid: false,
        };
      }

      const encodedData = parts[1];
      const licenseData = this.decodeLicenseData(encodedData);

      if (!licenseData) {
        return {
          expired: false,
          message: "Invalid license key. Unable to decode license data.",
          valid: false,
        };
      }

      // Check if license has expired
      const now = new Date();
      const expiryDate = new Date(licenseData.expiryDate);

      if (expiryDate < now) {
        return {
          data: licenseData,
          expired: true,
          message: `License expired on ${licenseData.expiryDate}. Please renew your license.`,
          valid: false,
        };
      }

      return {
        data: licenseData,
        expired: false,
        valid: true,
      };
    } catch {
      return {
        expired: false,
        message: "Invalid license key format or corrupted data.",
        valid: false,
      };
    }
  }
}
