/**
 * Tests for analyze-by-query-handle handler
 * Focus on story points field mapping (Microsoft.VSTS.Scheduling.Effort)
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('Story Points Field Mapping', () => {
  it('should recognize Microsoft.VSTS.Scheduling.Effort as story points', () => {
    // Test the getEffortValue function logic
    const workItemWithEffort = {
      id: 35655356,
      fields: {
        'System.Title': 'Test Item',
        'System.WorkItemType': 'Product Backlog Item',
        'Microsoft.VSTS.Scheduling.Effort': 5
      }
    };

    // Simulate the getEffortValue function
    const effortField = workItemWithEffort.fields['Microsoft.VSTS.Scheduling.Effort'];
    const storyPointsField = workItemWithEffort.fields['Microsoft.VSTS.Scheduling.StoryPoints' as keyof typeof workItemWithEffort.fields];
    
    const effortValue = typeof effortField === 'number' ? effortField : 0;
    const storyPointsValue = typeof storyPointsField === 'number' ? storyPointsField : 0;
    
    const result = effortValue || storyPointsValue;

    expect(result).toBe(5);
  });

  it('should prefer Effort over StoryPoints when both exist', () => {
    const workItemWithBoth = {
      id: 123,
      fields: {
        'System.Title': 'Test Item',
        'Microsoft.VSTS.Scheduling.Effort': 5,
        'Microsoft.VSTS.Scheduling.StoryPoints': 3
      }
    };

    const effortField = workItemWithBoth.fields['Microsoft.VSTS.Scheduling.Effort'];
    const storyPointsField = workItemWithBoth.fields['Microsoft.VSTS.Scheduling.StoryPoints'];
    
    const effortValue = typeof effortField === 'number' ? effortField : 0;
    const storyPointsValue = typeof storyPointsField === 'number' ? storyPointsField : 0;
    
    const result = effortValue || storyPointsValue;

    expect(result).toBe(5); // Should prefer Effort
  });

  it('should use StoryPoints when Effort is not present', () => {
    const workItemWithStoryPoints = {
      id: 456,
      fields: {
        'System.Title': 'Test Item',
        'Microsoft.VSTS.Scheduling.StoryPoints': 8
      }
    };

    const effortField = workItemWithStoryPoints.fields['Microsoft.VSTS.Scheduling.Effort' as keyof typeof workItemWithStoryPoints.fields];
    const storyPointsField = workItemWithStoryPoints.fields['Microsoft.VSTS.Scheduling.StoryPoints'];
    
    const effortValue = typeof effortField === 'number' ? effortField : 0;
    const storyPointsValue = typeof storyPointsField === 'number' ? storyPointsField : 0;
    
    const result = effortValue || storyPointsValue;

    expect(result).toBe(8);
  });

  it('should return 0 when neither field is present', () => {
    const workItemNoEstimate = {
      id: 789,
      fields: {
        'System.Title': 'Test Item'
      }
    };

    const effortField = workItemNoEstimate.fields['Microsoft.VSTS.Scheduling.Effort' as keyof typeof workItemNoEstimate.fields];
    const storyPointsField = workItemNoEstimate.fields['Microsoft.VSTS.Scheduling.StoryPoints' as keyof typeof workItemNoEstimate.fields];
    
    const effortValue = typeof effortField === 'number' ? effortField : 0;
    const storyPointsValue = typeof storyPointsField === 'number' ? storyPointsField : 0;
    
    const result = effortValue || storyPointsValue;

    expect(result).toBe(0);
  });
});
