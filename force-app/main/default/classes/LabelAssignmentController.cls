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
     * @return List<Map<String, Object>> List of enriched assignments for the specified label
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getLabelAssignments(String labelId) {
        try {
            if (String.isBlank(labelId)) {
                return new List<Map<String, Object>>();
            }
            
            List<UserDefinedLabelAssignment> assignments = [
                SELECT Id, ItemId, EntityType, SubjectOrName
                FROM UserDefinedLabelAssignment
                WHERE UserDefinedLabelId = :labelId
                ORDER BY SubjectOrName ASC
            ];
            
            // Create a list to hold the enriched assignments
            List<Map<String, Object>> enrichedAssignments = new List<Map<String, Object>>();
            
            // Create a set of Case IDs that need to be queried
            Set<Id> caseIds = new Set<Id>();
            
            // First pass: identify which records are Cases based on their ItemId
            for (UserDefinedLabelAssignment assign : assignments) {
                if (assign.ItemId != null && assign.ItemId.startsWith('500')) {
                    try {
                        Id caseId = Id.valueOf(assign.ItemId);
                        caseIds.add(caseId);
                    } catch (Exception e) {
                        // Not a valid ID, skip
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
                
                // If this is a Case, enhance the data
                if (assign.ItemId != null && assign.ItemId.startsWith('500') && casesMap.containsKey(assign.ItemId)) {
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
}
