/**
 * License Manager for ApexStock
 * Handles license validation and management
 */
export default class LicenseManager {
    static licenseKey: any;
    static validationResult: any;
    /**
     * Decode license data from encoded string
     * This is a simple base64 + JSON approach - you can make it more sophisticated
     */
    static decodeLicenseData(encodedData: any): {
        expiryDate: any;
        issueDate: any;
        plan: any;
        valid: boolean;
    };
    /**
     * Generate a license key (for your internal use)
     * You would use this on your server/admin panel to generate keys for customers
     */
    static generateLicenseKey(issueDate: any, expiryDate: any, plan?: string): string;
    /**
     * Get current license validation result
     */
    static getLicenseStatus(): any;
    /**
     * Check if current license is valid
     */
    static isLicenseValid(): any;
    /**
     * Set the global license key
     */
    static setLicense(key: any): void;
    /**
     * Validate license key format and content
     */
    static validateLicense(key: any): {
        expired: boolean;
        message: string;
        valid: boolean;
        data?: undefined;
    } | {
        data: {
            expiryDate: any;
            issueDate: any;
            plan: any;
            valid: boolean;
        };
        expired: boolean;
        message: string;
        valid: boolean;
    } | {
        data: {
            expiryDate: any;
            issueDate: any;
            plan: any;
            valid: boolean;
        };
        expired: boolean;
        valid: boolean;
        message?: undefined;
    };
}
