import { LightningElement, wire, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getLabels from '@salesforce/apex/LabelAssignmentController.getLabels';
import deleteLabel from '@salesforce/apex/LabelAssignmentController.deleteLabel';

export default class LabelSelector extends LightningElement {
    @track labels = [];
    @track selectedLabelId;
    @track isLoading = false;
    @track error;
    @track isDeleteModalOpen = false;
    
    @wire(getLabels)
    wiredLabels(result) {
        this.isLoading = true;
        this.labels = [{ label: 'Select a label...', value: '' }]; // Default option
        
        if (result.data) {
            // Process labels for combobox
            const labelOptions = result.data.map(label => {
                return {
                    label: label.Name,
                    value: label.Id
                };
            });
            
            // Add labels to options array
            this.labels = [{ label: 'Select a label...', value: '' }, ...labelOptions];
            this.error = undefined;
        } else if (result.error) {
            this.error = this.reduceErrors(result.error);
        }
        
        this.isLoading = false;
    }
    
    // Handle label selection change
    handleLabelChange(event) {
        this.selectedLabelId = event.detail.value;
        
        // If a label is selected, dispatch event to parent
        if (this.selectedLabelId) {
            const selectedLabel = this.labels.find(option => option.value === this.selectedLabelId);
            const labelName = selectedLabel ? selectedLabel.label : '';
            
            // Create custom event with label info
            const selectEvent = new CustomEvent('labelselect', {
                detail: {
                    labelId: this.selectedLabelId,
                    labelName: labelName
                }
            });
            
            // Dispatch the event to the parent component
            this.dispatchEvent(selectEvent);
        } else {
            // If no label is selected (back to default option)
            const selectEvent = new CustomEvent('labelselect', {
                detail: {
                    labelId: '',
                    labelName: ''
                }
            });
            
            // Dispatch the event to the parent component
            this.dispatchEvent(selectEvent);
        }
    }
    
    // Get the current selected label name
    get currentLabelName() {
        if (this.selectedLabelId) {
            const selectedLabel = this.labels.find(option => option.value === this.selectedLabelId);
            return selectedLabel ? selectedLabel.label : '';
        }
        return '';
    }
    
    // Check if no label is selected
    get noLabelSelected() {
        return !this.selectedLabelId;
    }
    
    // Handle delete label button click
    handleDeleteLabel() {
        if (this.selectedLabelId) {
            // Open confirmation modal
            this.isDeleteModalOpen = true;
        }
    }
    
    // Delete label and all assignments
    deleteLabelAndAssignments() {
        this.isLoading = true;
        
        // Call Apex method to delete label and assignments
        deleteLabel({ labelId: this.selectedLabelId })
            .then(() => {
                // Show success message
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: `Label "${this.currentLabelName}" was deleted successfully.`,
                        variant: 'success'
                    })
                );
                
                // Reset selected label
                this.selectedLabelId = '';
                
                // Close modal
                this.isDeleteModalOpen = false;
                
                // Refresh data
                this.refreshData();
                
                // Dispatch event to parent component
                const deleteEvent = new CustomEvent('labeldelete', {
                    detail: {
                        labelId: this.selectedLabelId
                    }
                });
                
                // Dispatch the event to the parent component
                this.dispatchEvent(deleteEvent);
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
    
    // Cancel delete label
    cancelDeleteLabel() {
        this.isDeleteModalOpen = false;
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
    
    // Public method to refresh data
    @api refreshData() {
        return new Promise((resolve, reject) => {
            // Refresh the wire adapter
            this.isLoading = true;
            
            getLabels()
                .then(result => {
                    // Process labels for combobox
                    const labelOptions = result.map(label => {
                        return {
                            label: label.Name,
                            value: label.Id
                        };
                    });
                    
                    // Add labels to options array
                    this.labels = [{ label: 'Select a label...', value: '' }, ...labelOptions];
                    this.error = undefined;
                    
                    // Check if the previously selected label still exists
                    if (this.selectedLabelId) {
                        const stillExists = this.labels.some(option => option.value === this.selectedLabelId);
                        if (!stillExists) {
                            // If the label no longer exists, reset selection
                            this.selectedLabelId = '';
                            
                            // Dispatch event to parent component
                            const selectEvent = new CustomEvent('labelselect', {
                                detail: {
                                    labelId: '',
                                    labelName: ''
                                }
                            });
                            
                            // Dispatch the event to the parent component
                            this.dispatchEvent(selectEvent);
                        }
                    }
                    
                    resolve();
                })
                .catch(error => {
                    this.error = this.reduceErrors(error);
                    reject(error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        });
    }
}