import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getUserDefinedLabels from '@salesforce/apex/LabelAssignmentController.getUserDefinedLabels';
import deleteLabel from '@salesforce/apex/LabelAssignmentController.deleteLabel';

export default class LabelSelector extends LightningElement {
    @api title = 'Label Selector';
    @track labelOptions = [];
    @track selectedLabelId;
    @track isDeleteLabelModalOpen = false;
    @track selectedLabelName = '';
    @track error;
    @track isLoading = true;
    @track labelsWireResult;
    
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
    
    // Handle label selection change
    handleLabelChange(event) {
        this.selectedLabelId = event.detail.value;
        
        // Notify parent component about the selection change
        this.dispatchEvent(new CustomEvent('labelselect', {
            detail: { 
                labelId: this.selectedLabelId,
                labelName: this.currentLabelName 
            }
        }));
    }
    
    // Computed property to get the currently selected label name
    get currentLabelName() {
        if (!this.selectedLabelId || this.labelOptions.length === 0) {
            return '';
        }
        
        const selectedOption = this.labelOptions.find(option => option.value === this.selectedLabelId);
        return selectedOption ? selectedOption.label : '';
    }
    
    // Computed property for disabled state of Delete Label button
    get noLabelSelected() {
        return !this.selectedLabelId;
    }
    
    // Show confirmation dialog for deleting label
    handleDeleteLabel() {
        if (!this.selectedLabelId) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Warning',
                    message: 'Please select a label to delete',
                    variant: 'warning'
                })
            );
            return;
        }
        
        this.selectedLabelName = this.currentLabelName;
        this.isDeleteLabelModalOpen = true;
    }
    
    // Delete the current label and all its assignments
    deleteLabelAndAssignments() {
        if (!this.selectedLabelId) {
            return;
        }
        
        this.isLoading = true;
        this.isDeleteLabelModalOpen = false;
        
        deleteLabel({ labelId: this.selectedLabelId })
            .then(() => {
                // Show success toast
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: `Label "${this.selectedLabelName}" was deleted with all its assignments`,
                        variant: 'success'
                    })
                );
                
                // Reset selected label and refresh data
                this.selectedLabelId = null;
                
                // Notify parent about the deletion
                this.dispatchEvent(new CustomEvent('labeldelete', {
                    detail: { 
                        labelId: this.selectedLabelId
                    }
                }));
                
                return refreshApex(this.labelsWireResult);
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error deleting label',
                        message: this.reduceErrors(error),
                        variant: 'error'
                    })
                );
                this.isLoading = false;
            });
    }
    
    // Cancel delete label
    cancelDeleteLabel() {
        this.isDeleteLabelModalOpen = false;
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
    
    // Refresh the data
    @api refreshData() {
        this.isLoading = true;
        
        return refreshApex(this.labelsWireResult)
            .finally(() => {
                this.isLoading = false;
            });
    }
}