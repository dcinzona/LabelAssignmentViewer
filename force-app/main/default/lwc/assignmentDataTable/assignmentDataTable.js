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
    @track deletingAssignment = null;
    
    connectedCallback() {
        // Define columns when component is initialized
        this.columns = [
            // Column for record name/subject with popover on hover
            {
                label: 'Name',
                fieldName: 'SubjectOrName',
                sortable: true,
                type: 'text',
                cellAttributes: {
                    class: 'record-popover-cell slds-cell-wrap',
                    'data-record-id': { fieldName: 'ItemId' },
                    'data-object-api-name': { fieldName: 'ObjectApiName' },
                    'data-icon-name': { fieldName: 'iconName' },
                    'data-subject-or-name': { fieldName: 'SubjectOrName' }
                }
            },
            // Column for Label Assigned Date (formatted)
            {
                label: 'Label Assigned Date',
                fieldName: 'LabelAssignedDate',
                sortable: true,
                type: 'date',
                typeAttributes: {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                },
                cellAttributes: {
                    alignment: 'left'
                }
            },
            // Column for object type
            {
                label: 'Object Type',
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
                        { label: 'View Record', name: 'view_record' },
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
                // Add URL for navigation
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
        
        // Set timeout to initialize popovers after render
        setTimeout(() => {
            this.initializePopovers();
        }, 250);
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
    
    // Handle row actions from the lightning-button-menu
    handleRowAction(event) {
        const action = event.detail.action;
        const row = event.detail.row;
        
        switch (action.name) {
            case 'view_record':
                this.navigateToRecord(row.ItemId);
                break;
            case 'navigate_to_record':
                this.navigateToRecord(row.ItemId);
                break;
            case 'delete':
                this.confirmDelete(row);
                break;
            default:
                // Default action
                break;
        }
    }
    
    // Handle record click (from the new table format)
    handleRecordClick(event) {
        const recordId = event.currentTarget.dataset.recordId;
        if (recordId) {
            this.navigateToRecord(recordId);
        }
    }
    
    // Handle view record action from menu
    handleViewRecord(event) {
        const recordId = event.currentTarget.dataset.recordId;
        if (recordId) {
            this.navigateToRecord(recordId);
        }
    }
    
    // Handle delete record action from menu
    handleDeleteRecord(event) {
        const recordId = event.currentTarget.dataset.recordId;
        const recordName = event.currentTarget.dataset.recordName;
        
        if (recordId) {
            this.confirmDelete({
                Id: recordId,
                SubjectOrName: recordName
            });
        }
    }
    
    // Handle action menu click (+ button)
    handleActionClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const recordId = event.currentTarget.dataset.recordId;
        const index = event.currentTarget.dataset.recordIndex;
        
        if (recordId && index !== undefined) {
            // Toggle dropdown menu
            const dropdownTrigger = event.currentTarget.closest('.slds-dropdown-trigger');
            
            // Close all other open dropdowns first
            const allDropdowns = this.template.querySelectorAll('.slds-dropdown-trigger');
            allDropdowns.forEach(dropdown => {
                if (dropdown !== dropdownTrigger) {
                    dropdown.classList.remove('slds-is-open');
                }
            });
            
            // Toggle current dropdown
            dropdownTrigger.classList.toggle('slds-is-open');
            
            // Add click event listener to document to close dropdown when clicking outside
            if (dropdownTrigger.classList.contains('slds-is-open')) {
                setTimeout(() => {
                    window.addEventListener('click', this.closeDropdowns.bind(this));
                }, 0);
            }
        }
    }
    
    // Close all dropdowns when clicking outside
    closeDropdowns() {
        const dropdowns = this.template.querySelectorAll('.slds-dropdown-trigger');
        dropdowns.forEach(dropdown => {
            dropdown.classList.remove('slds-is-open');
        });
        window.removeEventListener('click', this.closeDropdowns.bind(this));
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
    
    // Handle view record action from dropdown
    handleViewRecord(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const recordId = event.currentTarget.dataset.recordId;
        if (recordId) {
            this.navigateToRecord(recordId);
        }
        
        // Close all dropdowns
        this.closeDropdowns();
    }
    
    // Handle delete record action from dropdown
    handleDeleteRecord(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const recordId = event.currentTarget.dataset.recordId;
        if (recordId) {
            const assignment = this.assignments.find(item => item.ItemId === recordId);
            if (assignment) {
                this.confirmDelete(assignment);
            }
        }
        
        // Close all dropdowns
        this.closeDropdowns();
    }
    
    // Confirm deletion of an assignment
    confirmDelete(row) {
        // Use the modal instead of browser confirm dialog
        this.deletingAssignment = row;
        this.isDeleteModalOpen = true;
    }
    
    // This method is no longer needed as the deletion is handled in deleteSelectedAssignments
    // keeping it for reference
    /*
    deleteAssignment(assignmentId) {
        // Logic moved to deleteSelectedAssignments
    }
    */
    
    // Handle column sorting
    handleSort(event) {
        this.sortBy = event.detail.fieldName;
        this.sortDirection = event.detail.sortDirection;
        this.sortData(this.sortBy, this.sortDirection);
    }
    
    // Handle header click for sorting our custom table
    handleHeaderClick(event) {
        const fieldName = event.currentTarget.dataset.field;
        
        if (fieldName) {
            // Toggle sort direction if clicking on the same field
            if (this.sortBy === fieldName) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortBy = fieldName;
                this.sortDirection = 'asc'; // Default to ascending for new field
            }
            
            // Sort the data with the new sort parameters
            this.sortData(this.sortBy, this.sortDirection);
            
            // Update visual indicators for sort
            this.updateSortIndicators();
        }
    }
    
    // Update the visual indicators for the sorted column
    updateSortIndicators() {
        // Reset all headers
        const headers = this.template.querySelectorAll('th[data-field]');
        headers.forEach(header => {
            header.removeAttribute('data-sort-active');
            header.removeAttribute('data-sort-direction');
        });
        
        // Set active sort on current column
        const activeHeader = this.template.querySelector(`th[data-field="${this.sortBy}"]`);
        if (activeHeader) {
            activeHeader.setAttribute('data-sort-active', 'true');
            activeHeader.setAttribute('data-sort-direction', this.sortDirection);
        }
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
    
    // Calculate one-based index for template iteration
    get indexPlusOne() {
        return (index) => index + 1;
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
        
        // Update sort indicators if we have a sort field
        if (this.sortBy) {
            this.updateSortIndicators();
        }
        
        // Update row numbers
        this.updateRowNumbers();
    }
    
    // Update row numbers to show index+1
    updateRowNumbers() {
        // Get all rows in the table
        const rows = this.template.querySelectorAll('tr[data-index]');
        
        // Update each row with its index + 1
        rows.forEach(row => {
            const index = parseInt(row.getAttribute('data-index'), 10);
            const indexNum = index + 1;
            const indexElement = row.querySelector('.index-number');
            if (indexElement) {
                indexElement.textContent = indexNum;
            }
        });
    }
    
    // Initialize popovers for record detail
    initializePopovers() {
        const links = this.template.querySelectorAll('.record-link');
        if (!links || links.length === 0) {
            return;
        }
        
        links.forEach(link => {
            // Add hover event listeners to show popover
            link.addEventListener('mouseenter', (event) => {
                const recordId = event.currentTarget.dataset.recordId;
                const record = this.assignments.find(r => r.ItemId === recordId);
                
                if (record) {
                    event.currentTarget.title = `${record.ObjectType}: ${record.SubjectOrName}`;
                }
            });
        });
    }
}