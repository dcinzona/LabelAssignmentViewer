import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getUserDefinedLabels from '@salesforce/apex/LabelAssignmentController.getUserDefinedLabels';
import getLabelAssignments from '@salesforce/apex/LabelAssignmentController.getLabelAssignments';

export default class LabelAssignmentViewer extends LightningElement {
    @track labelOptions = [];
    @track selectedLabelId;
    @track assignments = [];
    @track filteredAssignments = [];
    @track searchTerm = '';
    @track error;
    @track isLoading = true;
    @track labelsWireResult;
    @track assignmentsWireResult;
    @track lastRefreshed = new Date();
    
    // Maximum number of records to show without pagination
    maxRecords = 100;
    
    connectedCallback() {
        // Initialize filtered assignments
        this.filteredAssignments = this.assignments;
        this.lastRefreshed = new Date();
    }

    // DataTable columns configuration with related list styling
    columns = [
        { 
            label: 'Assignment ID', 
            fieldName: 'Id', 
            type: 'text',
            hideDefaultActions: true,
            wrapText: false,
            cellAttributes: { 
                alignment: 'left'
            }
        },
        { 
            label: 'Item ID', 
            fieldName: 'ItemId', 
            type: 'text',
            hideDefaultActions: true,
            wrapText: false,
            cellAttributes: { 
                class: { fieldName: 'itemIdClass' },
                alignment: 'left'
            }
        },
        { 
            label: 'Entity Type', 
            fieldName: 'EntityType', 
            type: 'text',
            hideDefaultActions: true,
            wrapText: false,
            cellAttributes: { 
                alignment: 'left'
            }
        },
        { 
            label: 'Subject/Name', 
            fieldName: 'SubjectOrName', 
            type: 'text',
            hideDefaultActions: true,
            wrapText: true,
            cellAttributes: { 
                class: { fieldName: 'subjectClass' },
                alignment: 'left'
            }
        }
    ];

    // Wire service to get UserDefinedLabel records for the combobox
    @wire(getUserDefinedLabels)
    wiredLabels(result) {
        this.labelsWireResult = result;
        const { data, error } = result;
        
        if (data) {
            this.labelOptions = data.map(label => {
                return {
                    label: `${label.Name} (${label.TotalAssignments || 0})`,
                    value: label.Id
                };
            });
            this.error = undefined;
        } else if (error) {
            this.error = 'Error loading labels: ' + this.reduceErrors(error);
            this.labelOptions = [];
        }
        this.isLoading = false;
    }

    // Wire service to get UserDefinedLabelAssignment records based on selected label
    @wire(getLabelAssignments, { labelId: '$selectedLabelId' })
    wiredAssignments(result) {
        this.assignmentsWireResult = result;
        const { data, error } = result;
        
        if (data) {
            // Process and enhance records before assigning
            this.assignments = this.processAssignments(data);
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
        return records.map(record => {
            // Create a shallow clone of the record
            const enhancedRecord = { ...record };
            
            // Add styling classes based on record type
            if (record.ItemId && record.ItemId.startsWith('500')) {
                // This is a Case record
                enhancedRecord.itemIdClass = 'slds-text-color_success';
                enhancedRecord.subjectClass = 'slds-text-color_success slds-text-title_bold';
            }
            
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
        return !this.isLoading && !this.error && !this.selectedLabelId;
    }

    // Computed property to determine if we should show the no assignments state
    get showNoAssignmentsState() {
        if (this.isSearching && this.assignments.length > 0 && this.filteredAssignments.length === 0) {
            // When searching and no results found, but assignments exist
            return true;
        }
        return !this.isLoading && !this.error && this.selectedLabelId && 
               this.assignments && this.assignments.length === 0;
    }

    // Computed property to determine if we should show the datatable
    get showDataTable() {
        return !this.isLoading && !this.error && this.selectedLabelId && 
               this.assignments && this.assignments.length > 0 && 
               (!this.isSearching || (this.isSearching && this.filteredAssignments.length > 0));
    }

    get dontShowDataTable() {
        return this.isLoading || this.error || !this.selectedLabelId || 
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

    // Method to refresh the component data
    refreshData() {
        this.isLoading = true;
        return Promise.all([
            refreshApex(this.labelsWireResult),
            refreshApex(this.assignmentsWireResult)
        ]).finally(() => {
            this.isLoading = false;
            this.lastRefreshed = new Date();
        });
    }
}
