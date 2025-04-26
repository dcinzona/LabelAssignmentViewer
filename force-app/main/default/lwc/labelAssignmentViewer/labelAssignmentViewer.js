import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getUserDefinedLabels from '@salesforce/apex/LabelAssignmentController.getUserDefinedLabels';
import getLabelAssignments from '@salesforce/apex/LabelAssignmentController.getLabelAssignments';

export default class LabelAssignmentViewer extends LightningElement {
    @track labelOptions = [];
    @track selectedLabelId;
    @track assignments = [];
    @track error;
    @track isLoading = true;
    @track labelsWireResult;
    @track assignmentsWireResult;

    // DataTable columns configuration
    columns = [
        { label: 'Assignment ID', fieldName: 'Id', type: 'text' },
        { label: 'Name', fieldName: 'Name', type: 'text' },
        { label: 'Record ID', fieldName: 'RecordId', type: 'text' },
        { label: 'Object Name', fieldName: 'ObjectName', type: 'text' },
        { label: 'Value', fieldName: 'Value', type: 'text' },
        { label: 'Created Date', fieldName: 'CreatedDate', type: 'date' },
        { label: 'Last Modified Date', fieldName: 'LastModifiedDate', type: 'date' }
    ];

    // Wire service to get UserDefinedLabel records for the combobox
    @wire(getUserDefinedLabels)
    wiredLabels(result) {
        this.labelsWireResult = result;
        const { data, error } = result;
        
        if (data) {
            this.labelOptions = data.map(label => {
                return {
                    label: label.Name,
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
            this.assignments = data;
            this.error = undefined;
        } else if (error) {
            this.error = 'Error loading assignments: ' + this.reduceErrors(error);
            this.assignments = [];
        }
        this.isLoading = false;
    }

    // Handle label selection change
    handleLabelChange(event) {
        this.isLoading = true;
        this.selectedLabelId = event.detail.value;
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
        return !this.isLoading && !this.error && this.selectedLabelId && 
               this.assignments && this.assignments.length === 0;
    }

    // Computed property to determine if we should show the datatable
    get showDataTable() {
        return !this.isLoading && !this.error && this.selectedLabelId && 
               this.assignments && this.assignments.length > 0;
    }

    // Method to refresh the component data
    refreshData() {
        this.isLoading = true;
        return Promise.all([
            refreshApex(this.labelsWireResult),
            refreshApex(this.assignmentsWireResult)
        ]).finally(() => {
            this.isLoading = false;
        });
    }
}
