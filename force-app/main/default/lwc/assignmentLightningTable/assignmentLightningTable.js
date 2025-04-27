import { LightningElement, api, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAssignments from '@salesforce/apex/LabelAssignmentController.getAssignments';
import deleteAssignment from '@salesforce/apex/LabelAssignmentController.deleteAssignment';
import deleteAssignments from '@salesforce/apex/LabelAssignmentController.deleteAssignments';

const actions = [
    { label: 'View Record', name: 'view_record' },
    { label: 'Delete', name: 'delete' }
];

export default class AssignmentLightningTable extends NavigationMixin(LightningElement) {
    @api labelId;
    @api labelName;
    
    @track assignments = [];
    @track filteredAssignments = [];
    @track error;
    @track searchTerm = '';
    @track isLoading = false;
    @track selectedRows = [];
    @track selectedRowIds = [];
    @track isDeleteModalOpen = false;
    @track lastRefreshed = new Date();
    @track sortBy = 'SubjectOrName';
    @track sortDirection = 'asc';
    @track deletingAssignment = null;
    
    // Column configuration for lightning-datatable
    columns = [
        {
            label: 'Record',
            fieldName: 'recordUrl',
            type: 'url',
            typeAttributes: {
                label: { fieldName: 'SubjectOrName' },
                target: '_blank'
            },
            sortable: true
        },
        {
            label: 'Label Assigned Date',
            fieldName: 'LabelAssignedDate',
            type: 'date',
            typeAttributes: {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            },
            sortable: true
        },
        {
            label: 'Object Type',
            fieldName: 'ObjectType',
            type: 'text',
            sortable: true
        },
        {
            type: 'action',
            typeAttributes: { rowActions: actions }
        }
    ];
    
    // Wire method to get assignments for the selected label
    @wire(getAssignments, { labelId: '$labelId' })
    wiredAssignments(result) {
        this.isLoading = true;
        
        if (result.data) {
            this.processAssignments(result.data);
            this.error = undefined;
            this.selectedRows = [];
            this.selectedRowIds = [];
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
        if (!records) {
            records = [];
        }
        
        // Transform the records for the datatable
        this.assignments = records.map((record) => {
            // Create a processed record with enhanced fields for display
            const processedRecord = {
                Id: record.Id,
                ItemId: record.ItemId,
                SubjectOrName: record.SubjectOrName,
                ObjectType: record.ObjectType,
                ObjectApiName: record.ObjectApiName || 'Custom__c',
                iconName: record.IconName || 'standard:custom',
                RecordDetails: record.RecordDetails || {},
                // Add URL for navigation and linking
                recordUrl: `/lightning/r/${record.ItemId}/view`,
                // Use the actual assigned date from the record
                LabelAssignedDate: record.LabelAssignedDate || new Date()
            };
            
            return processedRecord;
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
            case 'view_record':
                this.navigateToRecord(row.ItemId);
                break;
            case 'delete':
                this.confirmDelete(row);
                break;
        }
    }
    
    // Navigate to the record detail page
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
        this.deletingAssignment = row;
        this.isDeleteModalOpen = true;
    }
    
    // Handle sort on the datatable
    handleSort(event) {
        this.sortBy = event.detail.fieldName;
        this.sortDirection = event.detail.sortDirection;
        this.sortData(this.sortBy, this.sortDirection);
    }
    
    // Sort the data based on field and direction
    sortData(fieldName, direction) {
        // Handle special case for URL field
        if (fieldName === 'recordUrl') {
            fieldName = 'SubjectOrName';
        }
        
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
    
    // Handle row selection from datatable
    handleRowSelection(event) {
        this.selectedRows = event.detail.selectedRows;
        this.selectedRowIds = this.selectedRows.map(row => row.Id);
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
        
        // If we're deleting a single assignment from the action menu
        if (this.deletingAssignment) {
            deleteAssignment({ assignmentId: this.deletingAssignment.Id })
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
                    this.deletingAssignment = null;
                });
        } 
        // Otherwise, we're deleting multiple selected assignments
        else if (this.selectedRows && this.selectedRows.length > 0) {
            // Collect IDs for bulk deletion
            const selectedIds = this.selectedRows.map(row => row.Id);
            
            // Call Apex method to delete assignments
            deleteAssignments({ assignmentIds: selectedIds })
                .then(() => {
                    // Show success message
                    // Create a more readable message based on the number of records deleted
                    const message = this.selectedRows.length === 1 
                        ? '1 assignment deleted successfully.'
                        : `${this.selectedRows.length} assignments deleted successfully.`;
                        
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Success',
                            message: message,
                            variant: 'success'
                        })
                    );
                    
                    // Reset selected rows
                    this.selectedRows = [];
                    this.selectedRowIds = [];
                    
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
    }
    
    // Cancel delete selected
    cancelDeleteSelected() {
        this.isDeleteModalOpen = false;
        this.deletingAssignment = null;
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
                        
                        // Clear selected rows
                        this.selectedRows = [];
                        this.selectedRowIds = [];
                        
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
                this.selectedRowIds = [];
                resolve();
            }
        });
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
    
    // Get record count text
    get recordCountText() {
        const count = this.filteredAssignments.length;
        return `${count} record${count !== 1 ? 's' : ''}`;
    }
    
    // Check if any rows are selected
    get hasSelectedRows() {
        return this.selectedRows && this.selectedRows.length > 0;
    }
    
    // Get the number of selected rows for display
    get selectedRowCount() {
        return this.selectedRows ? this.selectedRows.length : 0;
    }
    
    // Check if only a single record is selected
    get isSingleSelection() {
        return this.selectedRowCount === 1;
    }
    
    // Generate a dynamic label for the delete button based on selection count
    get deleteButtonLabel() {
        const count = this.selectedRowCount;
        if (count === 0) {
            return 'Delete Selected';
        } else if (count === 1) {
            return 'Delete (1)';
        } else {
            return `Delete (${count})`;
        }
    }
}