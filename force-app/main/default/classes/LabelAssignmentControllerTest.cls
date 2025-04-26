/**
 * @description Test class for LabelAssignmentController
 */
@isTest
private class LabelAssignmentControllerTest {
    
    /**
     * @description Set up test data
     */
    @TestSetup
    static void setupTestData() {
        // Create test UserDefinedLabel
        UserDefinedLabel testLabel = new UserDefinedLabel(
            Name = 'Test Label',
            OwnerId = UserInfo.getUserId()
        );
        insert testLabel;
        
        // Create test Case
        Case testCase = new Case(
            Subject = 'Test Case Subject',
            Status = 'New',
            Origin = 'Web'
        );
        insert testCase;
        
        // Create UserDefinedLabelAssignment for Case
        UserDefinedLabelAssignment caseAssignment = new UserDefinedLabelAssignment(
            LabelId = testLabel.Id,
            ItemId = testCase.Id,
            EntityType = 'Case',
            SubjectOrName = 'Original Subject'  // This will be overridden in the controller
        );
        
        // Create UserDefinedLabelAssignment for non-Case record
        UserDefinedLabelAssignment regularAssignment = new UserDefinedLabelAssignment(
            LabelId = testLabel.Id,
            ItemId = '001000000000001',  // Dummy Account ID (001 prefix)
            EntityType = 'Account',
            SubjectOrName = 'Test Account'
        );
        
        insert new List<UserDefinedLabelAssignment>{caseAssignment, regularAssignment};
    }
    
    /**
     * @description Test getUserDefinedLabels method returns labels with correct filter
     */
    @isTest
    static void testGetUserDefinedLabels() {
        Test.startTest();
        
        List<UserDefinedLabel> labels = LabelAssignmentController.getUserDefinedLabels();
        
        Test.stopTest();
        
        System.assertNotEquals(0, labels.size(), 'Should return at least one label');
        System.assertEquals('Test Label', labels[0].Name, 'Should return the test label');
        
        // Verify OwnerId filter is applied
        for (UserDefinedLabel label : labels) {
            System.assertEquals(UserInfo.getUserId(), label.OwnerId, 'Should only return labels owned by current user');
        }
    }
    
    /**
     * @description Test getLabelAssignments method with empty labelId
     */
    @isTest
    static void testGetLabelAssignmentsWithEmptyId() {
        Test.startTest();
        
        List<Map<String, Object>> assignments = LabelAssignmentController.getLabelAssignments('');
        
        Test.stopTest();
        
        System.assertEquals(0, assignments.size(), 'Should return empty list for blank labelId');
    }
    
    /**
     * @description Test getLabelAssignments method with valid labelId
     */
    @isTest
    static void testGetLabelAssignmentsWithValidId() {
        UserDefinedLabel testLabel = [SELECT Id FROM UserDefinedLabel WHERE Name = 'Test Label' LIMIT 1];
        Case testCase = [SELECT Id, CaseNumber, Subject FROM Case LIMIT 1];
        
        Test.startTest();
        
        List<Map<String, Object>> assignments = LabelAssignmentController.getLabelAssignments(testLabel.Id);
        
        Test.stopTest();
        
        System.assertEquals(2, assignments.size(), 'Should return two assignments');
        
        // Find the Case assignment in the results
        Map<String, Object> caseAssignment = null;
        Map<String, Object> regularAssignment = null;
        
        for (Map<String, Object> assignment : assignments) {
            String itemId = (String)assignment.get('ItemId');
            if (itemId.startsWith('500')) {
                caseAssignment = assignment;
            } else {
                regularAssignment = assignment;
            }
        }
        
        // Verify the Case assignment was enriched
        System.assertNotEquals(null, caseAssignment, 'Should find the Case assignment');
        System.assertEquals(true, caseAssignment.get('IsCaseRecord'), 'Should be marked as a Case record');
        System.assertEquals(testCase.CaseNumber, caseAssignment.get('CaseNumber'), 'Should have the Case number');
        System.assertEquals(testCase.Subject, caseAssignment.get('CaseSubject'), 'Should have the Case subject');
        System.assertEquals(testCase.CaseNumber + ' - ' + testCase.Subject, 
                            caseAssignment.get('SubjectOrName'), 
                            'SubjectOrName should be formatted as CaseNumber - Subject');
        
        // Verify the regular assignment wasn't modified
        System.assertNotEquals(null, regularAssignment, 'Should find the regular assignment');
        System.assertEquals('Test Account', regularAssignment.get('SubjectOrName'), 'Regular record should have original SubjectOrName');
        System.assertEquals(false, regularAssignment.containsKey('IsCaseRecord') && 
                           (Boolean)regularAssignment.get('IsCaseRecord'), 
                           'Regular record should not be marked as a Case');
    }
    
    /**
     * @description Test getLabelAssignments method with exception handling
     */
    @isTest
    static void testGetLabelAssignmentsExceptionHandling() {
        // Mock invalid ID that will cause an exception
        String invalidId = 'INVALID_ID';
        
        Test.startTest();
        
        try {
            LabelAssignmentController.getLabelAssignments(invalidId);
            System.assert(false, 'Should have thrown an exception');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Error retrieving Label Assignments'), 
                         'Exception message should indicate error retrieving assignments');
        }
        
        Test.stopTest();
    }
    
    /**
     * @description Test deleteAssignment method with valid assignment ID
     */
    @isTest
    static void testDeleteAssignment() {
        // Get test data
        UserDefinedLabel testLabel = [SELECT Id FROM UserDefinedLabel WHERE Name = 'Test Label' LIMIT 1];
        UserDefinedLabelAssignment testAssignment = [
            SELECT Id FROM UserDefinedLabelAssignment 
            WHERE LabelId = :testLabel.Id AND EntityType = 'Account' 
            LIMIT 1
        ];
        
        Integer countBefore = [SELECT COUNT() FROM UserDefinedLabelAssignment];
        
        Test.startTest();
        
        // Delete the assignment
        LabelAssignmentController.deleteAssignment(testAssignment.Id);
        
        Test.stopTest();
        
        // Verify the assignment was deleted
        Integer countAfter = [SELECT COUNT() FROM UserDefinedLabelAssignment];
        System.assertEquals(countBefore - 1, countAfter, 'Should have one less assignment after deletion');
        
        // Verify the specific assignment is gone
        List<UserDefinedLabelAssignment> remainingAssignments = [
            SELECT Id FROM UserDefinedLabelAssignment 
            WHERE Id = :testAssignment.Id
        ];
        System.assertEquals(0, remainingAssignments.size(), 'The deleted assignment should not exist');
    }
    
    /**
     * @description Test deleteAssignment method with empty assignment ID
     */
    @isTest
    static void testDeleteAssignmentWithEmptyId() {
        Test.startTest();
        
        try {
            LabelAssignmentController.deleteAssignment('');
            System.assert(false, 'Should have thrown an exception');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Assignment ID cannot be blank'), 
                         'Exception message should indicate blank assignment ID');
        }
        
        Test.stopTest();
    }
    
    /**
     * @description Test deleteAssignment method with invalid assignment ID
     */
    @isTest
    static void testDeleteAssignmentWithInvalidId() {
        Test.startTest();
        
        try {
            LabelAssignmentController.deleteAssignment('INVALID_ID');
            System.assert(false, 'Should have thrown an exception');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Error deleting assignment'), 
                         'Exception message should indicate error deleting assignment');
        }
        
        Test.stopTest();
    }
}