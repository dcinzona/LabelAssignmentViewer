import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class LabelAssignmentViewer extends LightningElement {
    @track selectedLabelId;
    @track selectedLabelName;
    @track isLoading = false;
    @track error;
    @track lastRefreshed = new Date();
    @track sortBy;
    @track sortDirection = 'asc';
    
    // Maximum number of records to show without pagination
    maxRecords = 100;
    
    // Row actions
    rowActions = [
        { label: 'View Record', name: 'view_record' },
        { label: 'Remove Label', name: 'delete' }
    ];
    
    // Object icon mapping
    objectIconMap = {
        'Case': 'standard:case',
        'Account': 'standard:account',
        'Contact': 'standard:contact',
        'Opportunity': 'standard:opportunity',
        'Lead': 'standard:lead',
        'Task': 'standard:task',
        'Event': 'standard:event',
        'Custom': 'standard:custom'
    };
    
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
    
    // Process assignment records to enhance data and add styling
    processAssignments(records) {
        return records.map(record => {
            // Create a shallow clone of the record
            const enhancedRecord = { ...record };
            
            // Set the icon based on the EntityType
            let iconName = this.objectIconMap[record.EntityType] || 'standard:custom';
            enhancedRecord.iconName = iconName;
            
            // Set recordUrl for navigation
            enhancedRecord.recordUrl = `/lightning/r/${record.ItemId}/view`;
            
            return enhancedRecord;
        });
    }

    // Handle label selection change
    handleLabelChange(event) {
        this.isLoading = true;
        this.selectedLabelId = event.detail.value;
        this.searchTerm = ''; // Reset search when label changes
    }
    
    // Handle search term change
    handleSearchChange(event) {
        this.searchTerm = event.target.value;
        this.filterAssignments();
    }
    
    // Filter assignments based on search term
    filterAssignments() {
        const searchTerm = this.searchTerm.toLowerCase();
        
        if (!searchTerm) {
            // If no search term, show all assignments
            this.filteredAssignments = this.assignments;
            return;
        }
        
        // Filter assignments that match the search term in any field
        this.filteredAssignments = this.assignments.filter(record => {
            // Search across all string fields (ignoring date fields)
            return this.searchInRecord(record, searchTerm);
        });
    }
    
    // Handle row actions (View/Delete) or button click for SubjectOrName
    handleRowAction(event) {
        const actionName = event.detail.action ? event.detail.action.name : event.detail.actionName;
        const row = event.detail.row;
        
        switch (actionName) {
            case 'view_record':
                this.navigateToRecord(row.ItemId);
                break;
                
            case 'delete':
                this.confirmDelete(row);
                break;
                
            default:
                break;
        }
    }
    
    // Navigate to record detail page
    navigateToRecord(rowOrId) {
        // Handle if we're passed a row object or just an ID
        const recordId = typeof rowOrId === 'object' ? rowOrId.ItemId : rowOrId;
        
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                actionName: 'view'
            }
        });
    }
    
    // Show confirmation dialog for delete
    confirmDelete(row) {
        if (confirm(`Are you sure you want to delete this assignment?`)) {
            this.deleteAssignment(row.Id);
        }
    }
    
    // Delete the assignment record
    deleteAssignment(assignmentId) {
        this.isLoading = true;
        
        deleteAssignment({ assignmentId: assignmentId })
            .then(() => {
                // Show success toast
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Assignment was deleted',
                        variant: 'success'
                    })
                );
                
                // Refresh data
                return this.refreshData();
            })
            .catch(error => {
                // Show error toast
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error deleting assignment',
                        message: this.reduceErrors(error),
                        variant: 'error'
                    })
                );
                this.isLoading = false;
            });
    }
    
    // Handle column sorting
    handleSort(event) {
        this.sortBy = event.detail.fieldName;
        this.sortDirection = event.detail.sortDirection;
        this.sortData(this.sortBy, this.sortDirection);
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