export default class SettingsControl {
    /**
     * Creates a reusable settings control box
     * @param {HTMLElement} container - The container element where the control will be placed
     * @param {Object} options - Configuration options
     * @param {Array} options.controls - Array of control objects
     * @param {Function} options.onChange - Callback function when settings change
     * @param {string} options.position - Position of the box (default: 'top-left')
     * @param {string} options.theme - Theme for the control (default: 'light')
     */
    constructor(container: HTMLElement, options?: {
        controls: any[];
        onChange: Function;
        position: string;
        theme: string;
    });
    container: HTMLElement;
    options: {
        controls: any[];
        onChange: Function;
        position: string;
        theme: string;
    };
    element: HTMLDivElement;
    isVisible: boolean;
    controlElements: {};
    focusedInputId: any;
    /**
     * Creates the settings control UI
     */
    create(): void;
    /**
     * Creates a single control based on type
     * @param {Object} control - Control configuration
     * @returns {HTMLElement} - Control element
     */
    createControl(control: any): HTMLElement;
    /**
     * Creates a range input control
     */
    createRangeControl(control: any): HTMLDivElement;
    /**
     * Creates a select dropdown control
     */
    createSelectControl(control: any): HTMLSelectElement;
    /**
     * Creates a number input control
     */
    createNumberControl(control: any): HTMLInputElement;
    /**
     * Creates a color picker control
     */
    createColorControl(control: any): HTMLInputElement;
    /**
     * Creates a toggle control
     */
    createToggleControl(control: any): HTMLLabelElement;
    /**
     * Creates a text input control
     */
    createTextControl(control: any): HTMLInputElement;
    /**
     * Handles change events and notifies listeners
     */
    onChange(controlId: any, value: any): void;
    restoreFocus(): void;
    /**
     * Shows the settings control
     */
    show(): void;
    /**
     * Hides the settings control
     */
    hide(): void;
    /**
     * Updates a control value
     * @param {string} controlId - ID of the control
     * @param {any} value - New value
     */
    updateControl(controlId: string, value: any): void;
    /**
     * Gets current value of a control
     * @param {string} controlId - ID of the control
     * @returns {any} - Current value
     */
    getValue(controlId: string): any;
    /**
     * Updates the theme of the control
     * @param {string} theme - 'light' or 'dark'
     */
    updateTheme(theme: string): void;
    /**
     * Destroys the settings control
     */
    destroy(): void;
}
