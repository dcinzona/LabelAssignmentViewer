/**
 * @description Apex controller for the labelAssignmentViewer LWC
 * Provides methods to fetch UserDefinedLabel and UserDefinedLabelAssignment records
 */
public with sharing class LabelAssignmentController {
    
    /**
     * @description Get all UserDefinedLabel records for display in the combobox
     * @return List<UserDefinedLabel> List of all UserDefinedLabel records
     */
    @AuraEnabled(cacheable=true)
    public static List<UserDefinedLabel> getLabels() {
        try {
            return [
                SELECT Id, Name, TotalAssignments
                FROM UserDefinedLabel
                WHERE OwnerId = :Userinfo.getUserId()
                ORDER BY Name ASC
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving User Defined Labels: ' + e.getMessage());
        }
    }
    
    /**
     * @description Get UserDefinedLabelAssignment records for a specific label
     * @param labelId The Id of the UserDefinedLabel to filter by
     * @return List<Map<String, Object>> List of enriched assignments for the specified label
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getAssignments(String labelId) {
        try {
            if (String.isBlank(labelId)) {
                return new List<Map<String, Object>>();
            }
            
            List<UserDefinedLabelAssignment> assignments = [
                SELECT Id, ItemId, EntityType, SubjectOrName
                FROM UserDefinedLabelAssignment
                WHERE LabelId = :labelId
                ORDER BY SubjectOrName ASC
            ];
            
            // Create a list to hold the enriched assignments
            List<Map<String, Object>> enrichedAssignments = new List<Map<String, Object>>();
            
            // Create a set of Case IDs that need to be queried
            Set<Id> caseIds = new Set<Id>();
            
            // First pass: identify which records are Cases based on their ItemId
            for (UserDefinedLabelAssignment assign : assignments) {
                String itemId = (String)assign.ItemId;
                if (assign.ItemId != null && ItemId.startsWith('500')) {
                    try {
                        Id caseId = Id.valueOf(assign.ItemId);
                        caseIds.add(caseId);
                    } catch (Exception e) {
                        // Not a valid ID, skip
                        System.debug('Invalid Case ID: ' + assign.ItemId);
                    }
                }
            }
            
            // Query Cases if there are any
            Map<Id, Case> casesMap = new Map<Id, Case>();
            if (!caseIds.isEmpty()) {
                casesMap = new Map<Id, Case>([
                    SELECT Id, Subject, CaseNumber
                    FROM Case
                    WHERE Id IN :caseIds
                ]);
            }
            
            // Second pass: create enriched records
            for (UserDefinedLabelAssignment assign : assignments) {
                Map<String, Object> enrichedRecord = new Map<String, Object>{
                    'Id' => assign.Id,
                    'ItemId' => assign.ItemId,
                    'EntityType' => assign.EntityType,
                    'SubjectOrName' => assign.SubjectOrName
                };
                
                String itemId = (String)assign.ItemId;
                // If this is a Case, enhance the data
                if (assign.ItemId != null && itemId.startsWith('500') && casesMap.containsKey(assign.ItemId)) {
                    Case caseRecord = casesMap.get(assign.ItemId);
                    enrichedRecord.put('SubjectOrName', caseRecord.CaseNumber + ' - ' + caseRecord.Subject);
                    enrichedRecord.put('IsCaseRecord', true);
                    enrichedRecord.put('CaseNumber', caseRecord.CaseNumber);
                    enrichedRecord.put('CaseSubject', caseRecord.Subject);
                }
                
                enrichedAssignments.add(enrichedRecord);
            }
            
            return enrichedAssignments;
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving Label Assignments: ' + e.getMessage());
        }
    }
    
    /**
     * @description Delete a UserDefinedLabelAssignment record
     * @param assignmentId The Id of the UserDefinedLabelAssignment to delete
     * @return void
     */
    @AuraEnabled
    public static void deleteAssignment(String assignmentId) {
        try {
            if (String.isBlank(assignmentId)) {
                throw new AuraHandledException('Assignment ID cannot be blank');
            }
            
            // Query the assignment to ensure it exists and is accessible
            List<UserDefinedLabelAssignment> assignments = [
                SELECT Id, LabelId 
                FROM UserDefinedLabelAssignment 
                WHERE Id = :assignmentId
                LIMIT 1
            ];
            
            if (assignments.isEmpty()) {
                throw new AuraHandledException('Assignment not found with ID: ' + assignmentId);
            }
            
            // Get the label to verify ownership (if needed)
            UserDefinedLabel label = [
                SELECT Id, OwnerId 
                FROM UserDefinedLabel 
                WHERE Id = :assignments[0].LabelId
                LIMIT 1
            ];
            
            // Verify the current user is the owner of the label
            if (label.OwnerId != UserInfo.getUserId()) {
                throw new AuraHandledException('You do not have permission to delete this assignment');
            }
            
            // Delete the assignment
            delete assignments[0];
            
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting assignment: ' + e.getMessage());
        }
    }
    
    /**
     * @description Delete multiple UserDefinedLabelAssignment records
     * @param assignmentIds List of UserDefinedLabelAssignment Ids to delete
     * @return void
     */
    @AuraEnabled
    public static void deleteMultipleAssignments(List<String> assignmentIds) {
        try {
            if (assignmentIds == null || assignmentIds.isEmpty()) {
                throw new AuraHandledException('No assignment IDs provided for deletion');
            }
            
            // Query the assignments to ensure they exist and are accessible
            List<UserDefinedLabelAssignment> assignments = [
                SELECT Id, LabelId 
                FROM UserDefinedLabelAssignment 
                WHERE Id IN :assignmentIds
            ];
            
            if (assignments.isEmpty()) {
                throw new AuraHandledException('No assignments found with the provided IDs');
            }
            
            // Get all label IDs from the assignments
            Set<Id> labelIds = new Set<Id>();
            for (UserDefinedLabelAssignment assignment : assignments) {
                labelIds.add(assignment.LabelId);
            }
            
            // Get the labels to verify ownership
            Map<Id, UserDefinedLabel> labelsMap = new Map<Id, UserDefinedLabel>([
                SELECT Id, OwnerId 
                FROM UserDefinedLabel 
                WHERE Id IN :labelIds
            ]);
            
            // Verify each assignment belongs to a label owned by the current user
            List<UserDefinedLabelAssignment> assignmentsToDelete = new List<UserDefinedLabelAssignment>();
            for (UserDefinedLabelAssignment assignment : assignments) {
                UserDefinedLabel label = labelsMap.get(assignment.LabelId);
                if (label != null && label.OwnerId == UserInfo.getUserId()) {
                    assignmentsToDelete.add(assignment);
                }
            }
            
            if (assignmentsToDelete.isEmpty()) {
                throw new AuraHandledException('You do not have permission to delete any of the selected assignments');
            }
            
            // Delete the assignments
            delete assignmentsToDelete;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting assignments: ' + e.getMessage());
        }
    }
    
    /**
     * @description Delete a UserDefinedLabel and all its assignments
     * @param labelId The Id of the UserDefinedLabel to delete
     * @return void
     */
    @AuraEnabled
    public static void deleteLabel(String labelId) {
        try {
            if (String.isBlank(labelId)) {
                throw new AuraHandledException('Label ID cannot be blank');
            }
            
            // Query the label to ensure it exists and is accessible
            List<UserDefinedLabel> labels = [
                SELECT Id, OwnerId, Name
                FROM UserDefinedLabel 
                WHERE Id = :labelId
                LIMIT 1
            ];
            
            if (labels.isEmpty()) {
                throw new AuraHandledException('Label not found with ID: ' + labelId);
            }
            
            // Verify the current user is the owner of the label
            if (labels[0].OwnerId != UserInfo.getUserId()) {
                throw new AuraHandledException('You do not have permission to delete this label');
            }
            
            // Delete related assignments first (optional, as this will be handled by cascade delete)
            List<UserDefinedLabelAssignment> assignments = [
                SELECT Id 
                FROM UserDefinedLabelAssignment 
                WHERE LabelId = :labelId
            ];
            
            if (!assignments.isEmpty()) {
                delete assignments;
            }
            
            // Then delete the label
            delete labels[0];
            
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting label: ' + e.getMessage());
        }
    }
}