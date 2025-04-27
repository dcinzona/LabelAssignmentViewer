import { LightningElement, api } from 'lwc';

export default class RecordDetailPopover extends LightningElement {
    @api recordId;
    @api recordType;
    @api recordName;
    @api iconName;
    @api fields = [];
    
    // Generates a unique ID for the popover
    get uniqueId() {
        return `popover_${this.recordId}_${Date.now()}`;
    }
    
    // Returns the icon name with namespace prefixes for the SVG symbols
    get formattedIconName() {
        if (!this.iconName) return 'standard:custom';
        
        const parts = this.iconName.split(':');
        if (parts.length !== 2) return 'standard:custom';
        
        return parts[1];
    }
    
    // Returns the icon category (standard, utility, etc.)
    get iconCategory() {
        if (!this.iconName) return 'standard';
        
        const parts = this.iconName.split(':');
        if (parts.length !== 2) return 'standard';
        
        return parts[0];
    }
    
    // Formats the SVG URL based on the icon category
    get svgUrl() {
        return `/assets/icons/${this.iconCategory}-sprite/svg/symbols.svg#${this.formattedIconName}`;
    }
    
    // Returns the CSS class for the icon
    get iconClass() {
        return `slds-icon slds-icon_small slds-icon-${this.iconCategory}-${this.formattedIconName}`;
    }
}