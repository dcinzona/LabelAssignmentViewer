import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class LabelAssignmentViewer extends LightningElement {
    @track selectedLabelId;
    @track selectedLabelName;
    @track isLoading = false;
    @track error;
    @track lastRefreshed = new Date();
    @track tableView = 'custom'; // Default to custom table view (options: 'custom' or 'standard')
    
    connectedCallback() {
        // Initialize component
        this.lastRefreshed = new Date();
    }
    
    // Handle label selection event from the label selector component
    handleLabelSelect(event) {
        this.selectedLabelId = event.detail.labelId;
        this.selectedLabelName = event.detail.labelName;
        
        // Refresh the assignments datatable
        this.refreshAssignmentDataTable();
    }
    
    // Handle label deletion event from the label selector component
    handleLabelDelete(event) {
        this.selectedLabelId = null;
        this.selectedLabelName = '';
        
        // Show success message (the label selector component already shows its own toast,
        // but this is to notify about assignments being refreshed)
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Label deleted. Assignments table refreshed.',
                variant: 'success'
            })
        );
        
        // Refresh the assignments datatable
        this.refreshAssignmentDataTable();
    }
    
    // Refresh the assignments datatable
    refreshAssignmentDataTable() {
        const datatable = this.template.querySelector('c-assignment-data-table');
        if (datatable) {
            return datatable.refreshData();
        }
        return Promise.resolve();
    }
    
    // Refresh the label selector
    refreshLabelSelector() {
        const selector = this.template.querySelector('c-label-selector');
        if (selector) {
            return selector.refreshData();
        }
        return Promise.resolve();
    }
    
    // Refresh all data
    refreshAllData() {
        this.isLoading = true;
        
        return Promise.all([
            this.refreshLabelSelector(),
            this.refreshAssignmentDataTable()
        ]).finally(() => {
            this.isLoading = false;
            this.lastRefreshed = new Date();
        });
    }
    
    // Handle refresh button click
    handleRefresh() {
        this.refreshAllData();
    }
    
    // Computed property to format the last refreshed time
    get formattedDateTime() {
        const now = this.lastRefreshed;
        return new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        }).format(now);
    }
}