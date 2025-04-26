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
    public static List<UserDefinedLabel> getUserDefinedLabels() {
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
     * @return List<UserDefinedLabelAssignment> List of assignments for the specified label
     */
    @AuraEnabled(cacheable=true)
    public static List<UserDefinedLabelAssignment> getLabelAssignments(String labelId) {
        try {
            if (String.isBlank(labelId)) {
                return new List<UserDefinedLabelAssignment>();
            }
            
            return [
                SELECT Id, ItemId, EntityType, SubjectOrName
                FROM UserDefinedLabelAssignment
                WHERE UserDefinedLabelId = :labelId
                ORDER BY Name ASC
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving Label Assignments: ' + e.getMessage());
        }
    }
}
