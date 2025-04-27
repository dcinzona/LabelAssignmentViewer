import { LightningElement, api, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAssignments from '@salesforce/apex/LabelAssignmentController.getAssignments';
import deleteAssignment from '@salesforce/apex/LabelAssignmentController.deleteAssignment';
import deleteAssignments from '@salesforce/apex/LabelAssignmentController.deleteAssignments';

export default class AssignmentDataTable extends NavigationMixin(LightningElement) {
    @api labelId;
    @api labelName;
    
    @track assignments = [];
    @track filteredAssignments = [];
    @track columns = [];
    @track error;
    @track searchTerm = '';
    @track isLoading = false;
    @track selectedRows = [];
    @track isDeleteModalOpen = false;
    @track lastRefreshed = new Date();
    @track sortBy = 'SubjectOrName';
    @track sortDirection = 'asc';
    
    connectedCallback() {
        // Define columns when component is initialized
        this.columns = [
            // Column for record name/subject with item icon
            {
                label: 'Name',
                fieldName: 'SubjectOrName',
                sortable: true,
                type: 'text',
                wrapText: false,
                cellAttributes: {
                    alignment: 'left'
                }
            },
            // Column for object type
            {
                label: 'Type',
                fieldName: 'ObjectType',
                sortable: true,
                type: 'text',
                wrapText: false,
                cellAttributes: {
                    alignment: 'left'
                }
            },
            // Column for action button
            {
                type: 'action',
                typeAttributes: {
                    rowActions: [
                        { label: 'View', name: 'view' },
                        { label: 'Delete', name: 'delete' }
                    ]
                }
            }
        ];
    }
    
    // Wire method to get assignments for the selected label
    @wire(getAssignments, { labelId: '$labelId' })
    wiredAssignments(result) {
        this.isLoading = true;
        
        if (result.data) {
            this.processAssignments(result.data);
            this.error = undefined;
            this.selectedRows = [];
        } else if (result.error) {
            this.error = this.reduceErrors(result.error);
            this.assignments = [];
            this.filteredAssignments = [];
        }
        
        this.isLoading = false;
        this.lastRefreshed = new Date();
    }
    
    // Process the assignments data
    processAssignments(records) {
        // Transform the records for the datatable
        this.assignments = records.map(record => {
            return {
                Id: record.Id,
                ItemId: record.ItemId,
                SubjectOrName: record.SubjectOrName,
                ObjectType: record.ObjectType,
                ObjectApiName: record.ObjectApiName,
                IconName: record.IconName,
                RecordDetails: record.RecordDetails
            };
        });
        
        // Sort the assignments
        this.sortData(this.sortBy, this.sortDirection);
        
        // Apply search filter if there's a search term
        this.filterAssignments();
    }
    
    // Handle search input changes
    handleSearchChange(event) {
        this.searchTerm = event.target.value.toLowerCase();
        this.filterAssignments();
    }
    
    // Filter assignments based on search term
    filterAssignments() {
        if (this.searchTerm === '') {
            // If no search term, show all assignments
            this.filteredAssignments = [...this.assignments];
        } else {
            // Filter assignments based on search term
            this.filteredAssignments = this.assignments.filter(record => {
                return this.searchInRecord(record, this.searchTerm);
            });
        }
    }
    
    // Handle row actions (view, delete)
    handleRowAction(event) {
        const action = event.detail.action;
        const row = event.detail.row;
        
        switch (action.name) {
            case 'view':
                this.navigateToRecord(row.ItemId);
                break;
            case 'delete':
                this.confirmDelete(row);
                break;
            default:
        }
    }
    
    // Navigate to the record
    navigateToRecord(recordId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                actionName: 'view'
            }
        });
    }
    
    // Confirm deletion of an assignment
    confirmDelete(row) {
        if (confirm(`Are you sure you want to delete the assignment for "${row.SubjectOrName}"?`)) {
            this.deleteAssignment(row.Id);
        }
    }
    
    // Delete an assignment
    deleteAssignment(assignmentId) {
        this.isLoading = true;
        
        deleteAssignment({ assignmentId: assignmentId })
            .then(() => {
                // Show success message
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Assignment deleted successfully.',
                        variant: 'success'
                    })
                );
                
                // Refresh data
                return this.refreshData();
            })
            .catch(error => {
                // Show error message
                this.error = this.reduceErrors(error);
                
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: this.error,
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
    
    // Handle column sorting
    handleSort(event) {
        this.sortBy = event.detail.fieldName;
        this.sortDirection = event.detail.sortDirection;
        this.sortData(this.sortBy, this.sortDirection);
    }
    
    // Sort the data based on field and direction
    sortData(fieldName, direction) {
        // Clone the data to avoid modifying the original data
        let sortedData = [...this.assignments];
        
        // Sort the data
        sortedData.sort((a, b) => {
            return this.compareValues(a, b, fieldName, direction);
        });
        
        // Update the assignments
        this.assignments = sortedData;
        
        // Update filtered assignments if there's a search term
        this.filterAssignments();
    }
    
    // Compare values for sorting
    compareValues(a, b, field, sortDirection) {
        let valueA = a[field] || '';
        let valueB = b[field] || '';
        
        // Convert to lowercase for case-insensitive comparison
        if (typeof valueA === 'string') {
            valueA = valueA.toLowerCase();
        }
        if (typeof valueB === 'string') {
            valueB = valueB.toLowerCase();
        }
        
        // Compare values
        let result = 0;
        if (valueA > valueB) {
            result = 1;
        } else if (valueA < valueB) {
            result = -1;
        }
        
        // If descending, negate the result
        return sortDirection === 'asc' ? result : -result;
    }
    
    // Search in record fields
    searchInRecord(record, searchTerm) {
        // Check if any field contains the search term
        return record.SubjectOrName?.toLowerCase().includes(searchTerm) ||
               record.ObjectType?.toLowerCase().includes(searchTerm);
    }
    
    // Helper function to extract error messages
    reduceErrors(errors) {
        if (!Array.isArray(errors)) {
            errors = [errors];
        }

        return errors
            .filter(error => !!error)
            .map(error => {
                // UI API read errors
                if (Array.isArray(error.body)) {
                    return error.body.map(e => e.message).join(', ');
                }
                // UI API DML, Apex and network errors
                else if (error.body && typeof error.body.message === 'string') {
                    return error.body.message;
                }
                // JS errors
                else if (typeof error.message === 'string') {
                    return error.message;
                }
                // Unknown error shape so try HTTP status text
                return error.statusText || 'Unknown error';
            })
            .join(', ');
    }
    
    // Show empty selection state when no label is selected
    get showEmptySelectionState() {
        return !this.labelId;
    }
    
    // Show no assignments state when label is selected but no assignments found
    get showNoAssignmentsState() {
        return this.labelId && 
               !this.isLoading && 
               this.filteredAssignments.length === 0;
    }
    
    // Show data table when assignments are available
    get showDataTable() {
        return this.labelId && 
               !this.isLoading && 
               this.filteredAssignments.length > 0;
    }
    
    // Don't show data table
    get dontShowDataTable() {
        return !this.labelId || 
               this.isLoading || 
               this.filteredAssignments.length === 0;
    }
    
    // Check if a search is being performed
    get isSearching() {
        return this.searchTerm !== '';
    }
    
    // Check if plural should be used
    get showPlural() {
        return this.assignments.length !== 1;
    }
    
    // Format the last refreshed time
    get formattedDateTime() {
        const now = this.lastRefreshed;
        return new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        }).format(now);
    }
    
    // Check if there are more records beyond the current page
    get hasMoreRecords() {
        return false; // For now, pagination is not implemented
    }
    
    // Information about pagination
    get paginationInfo() {
        return `${Math.min(50, this.filteredAssignments.length)} of ${this.filteredAssignments.length} items`;
    }
    
    // Show empty selection state when no label is selected
    get showEmptySelectionState() {
        return !this.labelId;
    }
    
    // Show empty assignments state when label is selected but no assignments found
    get showNoAssignmentsState() {
        return this.labelId && this.assignments.length === 0 && !this.isLoading && !this.error;
    }
    
    // Show data table when there are assignments to display
    get showDataTable() {
        return this.labelId && this.assignments.length > 0 && !this.isLoading && !this.error;
    }
    
    // Hide data table (opposite of showDataTable)
    get dontShowDataTable() {
        return !this.showDataTable;
    }
    
    // Check if rows are selected
    get hasSelectedRows() {
        return this.selectedRows && this.selectedRows.length > 0;
    }
    
    // Check if no rows are selected
    get hasNoSelectedRows() {
        return !this.hasSelectedRows;
    }
    
    // Handle row selection
    handleRowSelection(event) {
        this.selectedRows = event.detail.selectedRows.map(row => row.Id);
    }
    
    // Handle delete selected button click
    handleDeleteSelected() {
        if (this.hasSelectedRows) {
            this.isDeleteModalOpen = true;
        }
    }
    
    // Delete selected assignments
    deleteSelectedAssignments() {
        this.isLoading = true;
        this.isDeleteModalOpen = false;
        
        // Call Apex method to delete assignments
        deleteAssignments({ assignmentIds: this.selectedRows })
            .then(() => {
                // Show success message
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: `${this.selectedRows.length} assignment(s) deleted successfully.`,
                        variant: 'success'
                    })
                );
                
                // Reset selected rows
                this.selectedRows = [];
                
                // Refresh data
                return this.refreshData();
            })
            .catch(error => {
                // Show error message
                this.error = this.reduceErrors(error);
                
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: this.error,
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
    
    // Cancel delete selected
    cancelDeleteSelected() {
        this.isDeleteModalOpen = false;
    }
    
    // Public method to refresh data
    @api refreshData() {
        return new Promise((resolve, reject) => {
            // Only refresh if a label is selected
            if (this.labelId) {
                this.isLoading = true;
                
                getAssignments({ labelId: this.labelId })
                    .then(result => {
                        this.processAssignments(result);
                        this.error = undefined;
                        this.selectedRows = [];
                        resolve();
                    })
                    .catch(error => {
                        this.error = this.reduceErrors(error);
                        this.assignments = [];
                        this.filteredAssignments = [];
                        reject(error);
                    })
                    .finally(() => {
                        this.isLoading = false;
                        this.lastRefreshed = new Date();
                    });
            } else {
                // No label selected, nothing to refresh
                this.assignments = [];
                this.filteredAssignments = [];
                this.selectedRows = [];
                resolve();
            }
        });
    }
    
    // Initialize popovers for ItemId fields when component is rendered
    renderedCallback() {
        this.initializePopovers();
    }
    
    // Initialize popovers for record detail
    initializePopovers() {
        // Implementation for initializing popovers will be added later
        // This is a placeholder for the functionality that will use the RecordDetailPopover component
    }
}