import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

export default class RecordDetailPopover extends NavigationMixin(LightningElement) {
    @api recordId;
    @api objectApiName;
    @api iconName;
    @api name;
    @api objectLabel;
    @api recordDetails;
    @api uniqueId;
    
    // Generate a unique ID for the component if not provided
    get uniqueId() {
        return this.uniqueId || `popover-${this.recordId}`;
    }
    
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
    
    // Check if the record is a Case
    get isCaseRecord() {
        return this.objectApiName === 'Case';
    }
    
    // Format the record details for display in the popover
    get objectFields() {
        if (!this.recordDetails) {
            return [];
        }
        
        // Convert record details to array of field objects
        return Object.entries(this.recordDetails)
            .filter(([key]) => key !== 'Id') // Filter out the Id field
            .map(([key, value]) => {
                return {
                    key,
                    label: key,
                    value: value || 'N/A'
                };
            });
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