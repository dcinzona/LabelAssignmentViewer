import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

export default class RecordDetailPopover extends NavigationMixin(LightningElement) {
    @api recordId;
    @api objectApiName;
    @api iconName;
    @api name;
    @api objectLabel;
    @api recordDetails;
    
    // Format the icon name for use in the template
    get formattedIconName() {
        return this.iconName || 'standard:default';
    }
    
    // Get the category of the icon (e.g., 'standard', 'utility', 'custom')
    get iconCategory() {
        return this.formattedIconName.split(':')[0] || 'standard';
    }
    
    // Build the SVG URL for the icon
    get svgUrl() {
        return `/assets/icons/${this.iconCategory}-sprite/svg/symbols.svg#${this.formattedIconName.split(':')[1] || 'default'}`;
    }
    
    // Build the CSS class for the icon container
    get iconClass() {
        return `slds-icon_container slds-icon-${this.formattedIconName.replace(':', '-')}`;
    }
    
    // Check if the record has display fields
    get hasDisplayFields() {
        return this.displayFields && this.displayFields.length > 0;
    }
    
    // Format the record details for display in the popover
    get displayFields() {
        if (!this.recordDetails) {
            return [];
        }
        
        // Convert record details to array of field objects for display
        // Format field labels to be more user-friendly
        const fields = Object.entries(this.recordDetails)
            .filter(([key]) => key !== 'Id') // Filter out the Id field
            .map(([key, value]) => {
                // Format the label to be more user-friendly
                const label = this.formatFieldLabel(key);
                
                return {
                    key,
                    label: label,
                    value: value || '--',
                    isPhone: key.toLowerCase().includes('phone'),
                    isEmail: key.toLowerCase().includes('email'),
                    isUrl: key.toLowerCase().includes('website') || key.toLowerCase().includes('url')
                };
            });
            
        // For Salesforce standard object display, limit to most important fields
        // and order them appropriately
        if (fields.length > 6) {
            return fields.slice(0, 6); // Limit to 6 fields for display
        }
        
        return fields;
    }
    
    // Format the field label to be more user-friendly
    formatFieldLabel(key) {
        if (!key) return '';
        
        // Special cases for common fields
        if (key === 'SubjectOrName') return 'Name';
        if (key === 'CaseNumber') return 'Case Number';
        
        // Convert camelCase or snake_case to Title Case with spaces
        return key
            // Insert a space before all uppercase letters that follow a lowercase letter or number
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            // Replace underscores with spaces
            .replace(/_/g, ' ')
            // Capitalize the first letter of each word
            .replace(/\b\w/g, c => c.toUpperCase());
    }
    
    // Navigate to the record
    navigateToRecord() {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.recordId,
                objectApiName: this.objectApiName,
                actionName: 'view'
            }
        });
    }
}