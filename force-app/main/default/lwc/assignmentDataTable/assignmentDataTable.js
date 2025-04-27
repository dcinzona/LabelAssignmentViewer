import { LightningElement, api, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getLabelAssignments from '@salesforce/apex/LabelAssignmentController.getLabelAssignments';
import deleteAssignment from '@salesforce/apex/LabelAssignmentController.deleteAssignment';
import deleteMultipleAssignments from '@salesforce/apex/LabelAssignmentController.deleteMultipleAssignments';

export default class AssignmentDataTable extends NavigationMixin(LightningElement) {
    @api labelId;
    @api labelName;
    
    @track assignments = [];
    @track filteredAssignments = [];
    @track selectedRows = [];
    @track isDeleteModalOpen = false;
    @track searchTerm = '';
    @track error;
    @track isLoading = true;
    @track assignmentsWireResult;
    @track lastRefreshed = new Date();
    @track sortBy;
    @track sortDirection = 'asc';
    
    // Maximum number of records to show without pagination
    maxRecords = 100;
    
    // Row actions
    rowActions = [
        { label: 'View Record', name: 'view_record' },
        { label: 'Delete', name: 'delete' }
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
        // Initialize filtered assignments
        this.filteredAssignments = this.assignments;
        this.lastRefreshed = new Date();
        
        // Ensure selectedRows is properly initialized as an empty array
        this.selectedRows = [];
    }
    
    // DataTable columns configuration with related list styling
    get columns() {
        return [
            { 
                label: 'Subject/Name', 
                fieldName: 'SubjectOrName',
                type: 'button',
                typeAttributes: {
                    label: { fieldName: 'SubjectOrName' },
                    name: 'view_record',
                    variant: 'base',
                    iconName: { fieldName: 'iconName' },
                    iconPosition: 'left'
                },
                sortable: true,
                cellAttributes: { 
                    class: { fieldName: 'subjectClass' },
                    alignment: 'left'
                }
            },
            { 
                label: 'Entity Type', 
                fieldName: 'EntityType', 
                type: 'text',
                sortable: true,
                cellAttributes: { 
                    alignment: 'left'
                }
            },
            { 
                label: 'Item ID', 
                fieldName: 'ItemId', 
                type: 'text',
                sortable: true,
                cellAttributes: { 
                    class: { fieldName: 'itemIdClass' },
                    alignment: 'left'
                }
            },
            { 
                label: 'Assignment ID', 
                fieldName: 'Id', 
                type: 'text',
                sortable: true,
                cellAttributes: { 
                    alignment: 'left'
                }
            },
            {
                type: 'action',
                typeAttributes: {
                    rowActions: this.rowActions
                }
            }
        ];
    }

    // Wire service to get UserDefinedLabelAssignment records based on selected label
    @wire(getLabelAssignments, { labelId: '$labelId' })
    wiredAssignments(result) {
        this.assignmentsWireResult = result;
        const { data, error } = result;
        
        if (data) {
            // Process and enhance records before assigning
            this.assignments = this.processAssignments(data);
            this.sortData(this.sortBy, this.sortDirection);
            this.filterAssignments();
            this.error = undefined;
            this.lastRefreshed = new Date();
        } else if (error) {
            this.error = 'Error loading assignments: ' + this.reduceErrors(error);
            this.assignments = [];
            this.filteredAssignments = [];
        }
        this.isLoading = false;
    }
    
    // Process assignment records to enhance data and add styling
    processAssignments(records) {
        if (!records) return [];
        
        return records.map(record => {
            // Create a shallow clone of the record
            const enhancedRecord = { ...record };
            
            // Set the icon based on the EntityType
            let iconName = this.objectIconMap[record.EntityType] || 'standard:custom';
            enhancedRecord.iconName = iconName;
            
            // Set recordUrl for navigation
            enhancedRecord.recordUrl = `/${record.ItemId}`;
            
            // Add styling classes based on record type
            if (record.ItemId && record.ItemId.startsWith('500')) {
                // This is a Case record
                enhancedRecord.itemIdClass = 'slds-text-color_success';
                enhancedRecord.subjectClass = 'slds-text-color_success';
                enhancedRecord.iconName = 'standard:case';
                
                // Add additional fields for the popover
                enhancedRecord.popoverFields = [
                    { label: 'Case Number', value: record.CaseNumber || 'N/A' },
                    { label: 'Subject', value: record.CaseSubject || 'N/A' },
                    { label: 'Status', value: record.CaseStatus || 'N/A' },
                    { label: 'Priority', value: record.CasePriority || 'N/A' }
                ];
            } else {
                // For non-Case records
                enhancedRecord.popoverFields = [
                    { label: 'Record ID', value: record.ItemId },
                    { label: 'Type', value: record.EntityType },
                    { label: 'Name', value: record.SubjectOrName }
                ];
            }
            
            return enhancedRecord;
        });
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
    
    // Handle row actions (View/Delete)
    handleRowAction(event) {
        const actionName = event.detail.action.name;
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
    navigateToRecord(recordId) {
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
    
    // Sort the data based on field and direction
    sortData(fieldName, direction) {
        if (!fieldName) {
            // Default sort is by Subject/Name
            fieldName = 'SubjectOrName';
            direction = 'asc';
        }
        
        // Handle URL field special case
        if (fieldName === 'recordUrl') {
            fieldName = 'SubjectOrName';
        }
        
        const cloneData = [...this.assignments];
        
        cloneData.sort((a, b) => {
            return this.compareValues(a, b, fieldName, direction);
        });
        
        this.assignments = cloneData;
        this.filterAssignments();
    }
    
    // Helper comparison function for sorting
    compareValues(a, b, field, sortDirection) {
        const valueA = a[field] ? a[field].toString().toLowerCase() : '';
        const valueB = b[field] ? b[field].toString().toLowerCase() : '';
        
        let sortResult = 0;
        if (valueA > valueB) {
            sortResult = 1;
        }
        if (valueA < valueB) {
            sortResult = -1;
        }
        
        return sortDirection === 'asc' ? sortResult : -sortResult;
    }
    
    // Helper method to search within a record
    searchInRecord(record, searchTerm) {
        // Standard fields to search in
        const searchableFields = ['Id', 'ItemId', 'EntityType', 'SubjectOrName'];
        
        // Additional Case-specific fields to search if available
        if (record.IsCaseRecord) {
            searchableFields.push('CaseNumber', 'CaseSubject');
        }
        
        // Check if any field contains the search term
        return searchableFields.some(field => {
            const value = record[field];
            return value && value.toString().toLowerCase().includes(searchTerm);
        });
    }

    // Helper method to reduce errors to a string
    reduceErrors(errors) {
        if (!Array.isArray(errors)) {
            errors = [errors];
        }
        
        return errors.map(error => {
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
            // Unknown error shape, just stringify
            return JSON.stringify(error);
        }).join(', ');
    }

    // Computed property to determine if we should show the empty selection state
    get showEmptySelectionState() {
        return !this.isLoading && !this.error && !this.labelId;
    }

    // Computed property to determine if we should show the no assignments state
    get showNoAssignmentsState() {
        if (this.isSearching && this.assignments.length > 0 && this.filteredAssignments.length === 0) {
            // When searching and no results found, but assignments exist
            return true;
        }
        return !this.isLoading && !this.error && this.labelId && 
               this.assignments && this.assignments.length === 0;
    }

    // Computed property to determine if we should show the datatable
    get showDataTable() {
        return !this.isLoading && !this.error && this.labelId && 
               this.assignments && this.assignments.length > 0 && 
               (!this.isSearching || (this.isSearching && this.filteredAssignments.length > 0));
    }

    get dontShowDataTable() {
        return this.isLoading || this.error || !this.labelId || 
               (this.assignments && this.assignments.length === 0);
    }
    
    // Computed property to determine if we're in a search state
    get isSearching() {
        return this.searchTerm && this.searchTerm.length > 0;
    }
    
    // Computed property for pluralization in the items count
    get showPlural() {
        return this.assignments.length !== 1;
    }
    
    // Computed property to format the last refreshed time
    get formattedDateTime() {
        const now = this.lastRefreshed;
        return new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        }).format(now);
    }
    
    // Computed property to check if there are more records than the display limit
    get hasMoreRecords() {
        return this.filteredAssignments.length > this.maxRecords;
    }
    
    // Computed property for pagination info
    get paginationInfo() {
        if (this.hasMoreRecords) {
            return `1-${this.maxRecords} of ${this.filteredAssignments.length}`;
        }
        return null;
    }
    
    // Computed property to determine if bulk actions should be enabled
    get hasSelectedRows() {
        // Ensure we have a valid array and it has elements
        return Array.isArray(this.selectedRows) && this.selectedRows.length > 0;
    }
    
    // Computed property for disabled state of Delete Selected button
    get hasNoSelectedRows() {
        return !this.hasSelectedRows;
    }
    
    // Handler for row selection change
    handleRowSelection(event) {
        // Store the selected rows
        this.selectedRows = event.detail.selectedRows || [];
        
        // For debugging - log the number of selected rows
        console.log(`Selected rows changed: ${this.selectedRows.length} rows selected`);
        
        // Force component to re-evaluate the hasSelectedRows getter
        this.dispatchEvent(new CustomEvent('selectionchange', {
            detail: { selectedCount: this.selectedRows.length }
        }));
    }
    
    // Show confirmation dialog for deleting multiple assignments
    handleDeleteSelected() {
        if (!this.hasSelectedRows) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Warning',
                    message: 'Please select at least one assignment to delete',
                    variant: 'warning'
                })
            );
            return;
        }
        
        this.isDeleteModalOpen = true;
    }
    
    // Delete multiple assignments
    deleteSelectedAssignments() {
        if (!this.hasSelectedRows) {
            return;
        }
        
        this.isLoading = true;
        this.isDeleteModalOpen = false;
        
        const assignmentIds = this.selectedRows.map(row => row.Id);
        
        deleteMultipleAssignments({ assignmentIds: assignmentIds })
            .then(result => {
                // Show success toast
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: `${assignmentIds.length} assignment(s) were deleted`,
                        variant: 'success'
                    })
                );
                
                // Reset selected rows and refresh data
                this.selectedRows = [];
                return this.refreshData();
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error deleting assignments',
                        message: this.reduceErrors(error),
                        variant: 'error'
                    })
                );
                this.isLoading = false;
            });
    }
    
    // Cancel delete multiple assignments
    cancelDeleteSelected() {
        this.isDeleteModalOpen = false;
    }
    
    // Method to refresh the component data
    @api refreshData() {
        this.isLoading = true;
        return refreshApex(this.assignmentsWireResult).finally(() => {
            this.isLoading = false;
            this.lastRefreshed = new Date();
        });
    }
    
    // Initialize popover hover effects after render
    renderedCallback() {
        this.initializePopovers();
    }
    
    // Add event listeners for popover hover effects
    initializePopovers() {
        // Wait a moment for the DOM to be ready
        setTimeout(() => {
            const container = this.template.querySelector('.slds-table_header-fixed_container');
            if (container) {
                console.log('Container found');
                // Find all the hover elements
                const hoverElements = container.querySelectorAll('.item-id-hover');
                
                // Make sure we have the popovers in the DOM
                if (hoverElements && hoverElements.length > 0) {
                    console.log(`Found ${hoverElements.length} hover elements to initialize`);
                    
                    // Generate unique IDs for each popover to ensure they work independently
                    hoverElements.forEach((element, index) => {
                        const popover = element.querySelector('.slds-popover');
                        if (popover) {
                            const uniqueId = `tooltip_${index}_${Date.now()}`;
                            element.setAttribute('aria-describedby', uniqueId);
                            popover.setAttribute('id', uniqueId);
                        }
                    });
                }
            }
        }, 100);
    }
}