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
    
    // Handle switch to custom table view
    handleCustomTableView() {
        this.tableView = 'custom';
    }
    
    // Handle switch to standard table view
    handleStandardTableView() {
        this.tableView = 'standard';
    }
    
    // Determine if custom table should be shown
    get showCustomTable() {
        return this.tableView === 'custom';
    }
    
    // Determine if standard table should be shown
    get showStandardTable() {
        return this.tableView === 'standard';
    }
    
    // Get variant for custom table button
    get customTableVariant() {
        return this.tableView === 'custom' ? 'brand' : 'neutral';
    }
    
    // Get variant for standard table button
    get standardTableVariant() {
        return this.tableView === 'standard' ? 'brand' : 'neutral';
    }
    
    // Check if user has selected a label
    get showEmptySelectionState() {
        return !this.selectedLabelId;
    }
    
    // Updated refresh method to handle both table types
    refreshAssignmentDataTable() {
        // Try to refresh the custom table if it's showing
        if (this.showCustomTable) {
            const customTable = this.template.querySelector('c-assignment-data-table');
            if (customTable) {
                return customTable.refreshData();
            }
        }
        
        // Try to refresh the standard table if it's showing
        if (this.showStandardTable) {
            const standardTable = this.template.querySelector('c-assignment-lightning-table');
            if (standardTable) {
                return standardTable.refreshData();
            }
        }
        
        return Promise.resolve();
    }
}