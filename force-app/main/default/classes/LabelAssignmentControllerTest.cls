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

        // Create test Account
        Account testAccount = new Account(
            Name = 'Test Account'
        );
        insert testAccount;
        
        // Create UserDefinedLabelAssignment for Case
        UserDefinedLabelAssignment caseAssignment = new UserDefinedLabelAssignment(
            LabelId = testLabel.Id,
            ItemId = testCase.Id
        );
        
        // Create UserDefinedLabelAssignment for non-Case record
        UserDefinedLabelAssignment regularAssignment = new UserDefinedLabelAssignment(
            LabelId = testLabel.Id,
            ItemId = testAccount.Id
        );
        
        insert new List<UserDefinedLabelAssignment>{caseAssignment, regularAssignment};
    }
    
    /**
     * @description Test getLabels method returns labels with correct filter
     */
    @isTest
    static void testGetLabels() {
        Test.startTest();
        
        List<UserDefinedLabel> labels = LabelAssignmentController.getLabels();
        
        Test.stopTest();
        
        System.assertNotEquals(0, labels.size(), 'Should return at least one label');
        System.assertEquals('Test Label', labels[0].Name, 'Should return the test label');
        
        // Verify OwnerId filter is applied
        for (UserDefinedLabel label : labels) {
            System.assertEquals(UserInfo.getUserId(), label.OwnerId, 'Should only return labels owned by current user');
        }
    }
    
    /**
     * @description Test getAssignments method with empty labelId
     */
    @isTest
    static void testGetAssignmentsWithEmptyId() {
        Test.startTest();
        
        List<Map<String, Object>> assignments = LabelAssignmentController.getAssignments('');
        
        Test.stopTest();
        
        System.assertEquals(0, assignments.size(), 'Should return empty list for blank labelId');
    }
    
    /**
     * @description Test getAssignments method with valid labelId
     */
    @isTest
    static void testGetAssignmentsWithValidId() {
        UserDefinedLabel testLabel = [SELECT Id FROM UserDefinedLabel WHERE Name = 'Test Label' LIMIT 1];
        Case testCase = [SELECT Id, CaseNumber, Subject FROM Case LIMIT 1];
        
        Test.startTest();
        
        List<Map<String, Object>> assignments = LabelAssignmentController.getAssignments(testLabel.Id);
        
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
        
        // Test updated object properties based on our new controller response structure
        System.assertEquals('Case', caseAssignment.get('ObjectType'), 'Should have the correct object type');
        System.assertEquals('Case', caseAssignment.get('ObjectApiName'), 'Should have the correct API name');
        System.assertEquals('standard:case', caseAssignment.get('IconName'), 'Should have the correct icon name');
        
        // Verify RecordDetails structure
        Map<String, Object> recordDetails = (Map<String, Object>)caseAssignment.get('RecordDetails');
        System.assertNotEquals(null, recordDetails, 'Should have RecordDetails map');
        System.assertEquals(testCase.CaseNumber, recordDetails.get('CaseNumber'), 'Should have the Case number in RecordDetails');
        System.assertEquals(testCase.Subject, recordDetails.get('Subject'), 'Should have the Case subject in RecordDetails');
        
        // Verify name format
        System.assertEquals(testCase.CaseNumber + ' - ' + testCase.Subject, 
                            caseAssignment.get('SubjectOrName'), 
                            'SubjectOrName should be formatted as CaseNumber - Subject');
        
        // Verify the regular assignment fields
        System.assertNotEquals(null, regularAssignment, 'Should find the regular assignment');
        System.assertEquals('Test Account', regularAssignment.get('SubjectOrName'), 'Regular record should have original SubjectOrName');
        System.assertNotEquals(null, regularAssignment.get('RecordDetails'), 'Should have RecordDetails, even if empty');
    }
    
    /**
     * @description Test getAssignments method with exception handling
     */
    @isTest
    static void testGetAssignmentsExceptionHandling() {
        // Mock invalid ID that will cause an exception
        String invalidId = 'INVALID_ID';
        
        Test.startTest();
        
        try {
            LabelAssignmentController.getAssignments(invalidId);
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
            WHERE LabelId = :testLabel.Id
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
    
    /**
     * @description Test deleteAssignments method with valid assignment IDs
     */
    @isTest
    static void testDeleteAssignments() {
        // Get test data
        UserDefinedLabel testLabel = [SELECT Id FROM UserDefinedLabel WHERE Name = 'Test Label' LIMIT 1];
        List<UserDefinedLabelAssignment> assignments = [
            SELECT Id FROM UserDefinedLabelAssignment 
            WHERE LabelId = :testLabel.Id
        ];
        
        System.assertEquals(2, assignments.size(), 'Should have 2 test assignments');
        
        List<String> assignmentIds = new List<String>();
        for(UserDefinedLabelAssignment assign : assignments) {
            assignmentIds.add(assign.Id);
        }
        
        Test.startTest();
        
        // Delete the assignments
        LabelAssignmentController.deleteAssignments(assignmentIds);
        
        Test.stopTest();
        
        // Verify the assignments were deleted
        List<UserDefinedLabelAssignment> remainingAssignments = [
            SELECT Id FROM UserDefinedLabelAssignment 
            WHERE LabelId = :testLabel.Id
        ];
        
        System.assertEquals(0, remainingAssignments.size(), 'All assignments should be deleted');
    }
    
    /**
     * @description Test deleteAssignments method with empty list
     */
    @isTest
    static void testDeleteAssignmentsWithEmptyList() {
        Test.startTest();
        
        try {
            LabelAssignmentController.deleteAssignments(new List<String>());
            System.assert(false, 'Should have thrown an exception');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('No assignment IDs provided'), 
                         'Exception message should indicate no assignments provided');
        }
        
        Test.stopTest();
    }
    
    /**
     * @description Test deleteLabel method with valid label ID
     */
    @isTest
    static void testDeleteLabel() {
        // Get test data
        UserDefinedLabel testLabel = [SELECT Id FROM UserDefinedLabel WHERE Name = 'Test Label' LIMIT 1];
        
        Integer assignmentCountBefore = [SELECT COUNT() FROM UserDefinedLabelAssignment WHERE LabelId = :testLabel.Id];
        System.assertEquals(2, assignmentCountBefore, 'Should have 2 test assignments');
        
        Test.startTest();
        
        // Delete the label
        LabelAssignmentController.deleteLabel(testLabel.Id);
        
        Test.stopTest();
        
        // Verify the label was deleted
        List<UserDefinedLabel> remainingLabels = [SELECT Id FROM UserDefinedLabel WHERE Id = :testLabel.Id];
        System.assertEquals(0, remainingLabels.size(), 'The label should be deleted');
        
        // Verify assignments were deleted
        Integer assignmentCountAfter = [SELECT COUNT() FROM UserDefinedLabelAssignment WHERE LabelId = :testLabel.Id];
        System.assertEquals(0, assignmentCountAfter, 'All assignments should be deleted');
    }
    
    /**
     * @description Test deleteLabel method with empty label ID
     */
    @isTest
    static void testDeleteLabelWithEmptyId() {
        Test.startTest();
        
        try {
            LabelAssignmentController.deleteLabel('');
            System.assert(false, 'Should have thrown an exception');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Label ID cannot be blank'), 
                         'Exception message should indicate blank label ID');
        }
        
        Test.stopTest();
    }
    
    /**
     * @description Test deleteLabel method with invalid label ID
     */
    @isTest
    static void testDeleteLabelWithInvalidId() {
        Test.startTest();
        
        try {
            LabelAssignmentController.deleteLabel('INVALID_ID');
            System.assert(false, 'Should have thrown an exception');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Error deleting label'), 
                         'Exception message should indicate error deleting label');
        }
        
        Test.stopTest();
    }
}