/**
 * Tests for Get Last Substantive Change Handler
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { getLastSubstantiveChange } from '../../src/services/handlers/analysis/get-last-substantive-change.handler';
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { createADOHttpClient } from '../../src/utils/ado-http-client';
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { loadConfiguration } from '../../src/config/config';

jest.mock('../../src/utils/ado-http-client');
jest.mock('../../src/config/config');
jest.mock('../../src/utils/token-provider.js', () => ({
  getTokenProvider: jest.fn(() => async () => 'mock-token'),
  setTokenProvider: jest.fn()
}));

describe('Get Last Substantive Change Handler', () => {
  const mockHttpClient = {
    get: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createADOHttpClient as jest.Mock).mockReturnValue(mockHttpClient);
    (loadConfiguration as jest.Mock).mockReturnValue({
      azureDevOps: {
        organization: 'test-org',
        project: 'test-project'
      }
    });
  });

  describe('Basic functionality', () => {
    it('should identify work item creation as substantive change', async () => {
      const createdDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          id: 123,
          fields: {
            'System.CreatedDate': createdDate
          }
        }
      });

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          value: []
        }
      });

      const result = await getLastSubstantiveChange({
        workItemId: 123
      });

      expect(result.workItemId).toBe(123);
      expect(result.lastSubstantiveChange).toBeNull();
      expect(result.lastChangeType).toBe('No history');
      expect(result.automatedChangesSkipped).toBe(0);
      expect(result.daysSinceCreation).toBe(10);
    });

    it('should detect title change as substantive', async () => {
      const createdDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
      const changedDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          id: 123,
          fields: {
            'System.CreatedDate': createdDate
          }
        }
      });

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          value: [
            {
              rev: 2,
              fields: {
                'System.ChangedDate': changedDate,
                'System.ChangedBy': 'User One',
                'System.Title': 'Updated Title'
              }
            },
            {
              rev: 1,
              fields: {
                'System.ChangedDate': createdDate,
                'System.ChangedBy': 'User One',
                'System.Title': 'Original Title'
              }
            }
          ]
        }
      });

      const result = await getLastSubstantiveChange({
        workItemId: 123
      });

      expect(result.lastSubstantiveChange).toBe(changedDate);
      expect(result.daysInactive).toBe(5);
      expect(result.lastChangeType).toContain('Title');
      expect(result.allChangesWereAutomated).toBe(false);
    });

    it('should detect description change as substantive', async () => {
      const createdDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const changedDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          id: 456,
          fields: {
            'System.CreatedDate': createdDate
          }
        }
      });

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          value: [
            {
              rev: 2,
              fields: {
                'System.ChangedDate': changedDate,
                'System.ChangedBy': 'Developer A',
                'System.Description': 'Updated description with more details'
              }
            },
            {
              rev: 1,
              fields: {
                'System.ChangedDate': createdDate,
                'System.ChangedBy': 'Developer A',
                'System.Description': 'Original description'
              }
            }
          ]
        }
      });

      const result = await getLastSubstantiveChange({
        workItemId: 456
      });

      expect(result.lastSubstantiveChange).toBe(changedDate);
      expect(result.daysInactive).toBe(3);
      expect(result.lastChangeType).toContain('Description');
    });
  });

  describe('Automated field detection', () => {
    it('should skip iteration path changes as non-substantive', async () => {
      const createdDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const iterationChange = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const substantiveChange = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          id: 789,
          fields: {
            'System.CreatedDate': createdDate
          }
        }
      });

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          value: [
            {
              rev: 3,
              fields: {
                'System.ChangedDate': iterationChange,
                'System.ChangedBy': 'User One',
                'System.IterationPath': 'Sprint 5',
                'System.State': 'Active'  // State unchanged from rev 2
              }
            },
            {
              rev: 2,
              fields: {
                'System.ChangedDate': substantiveChange,
                'System.ChangedBy': 'User One',
                'System.State': 'Active',
                'System.IterationPath': 'Sprint 4'
              }
            },
            {
              rev: 1,
              fields: {
                'System.ChangedDate': createdDate,
                'System.ChangedBy': 'User One',
                'System.State': 'New',
                'System.IterationPath': 'Sprint 4'
              }
            }
          ]
        }
      });

      const result = await getLastSubstantiveChange({
        workItemId: 789
      });

      // The most recent substantive change is rev 2 (State changed from New to Active)
      expect(result.lastSubstantiveChange).toBe(substantiveChange);
      expect(result.daysInactive).toBe(10);
      expect(result.automatedChangesSkipped).toBe(1);
      expect(result.lastChangeType).toContain('State');
    });

    it('should skip area path changes as non-substantive', async () => {
      const createdDate = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString();
      const areaChange = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          id: 999,
          fields: {
            'System.CreatedDate': createdDate
          }
        }
      });

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          value: [
            {
              rev: 2,
              fields: {
                'System.ChangedDate': areaChange,
                'System.ChangedBy': 'Admin User',
                'System.AreaPath': 'Team B'
              }
            },
            {
              rev: 1,
              fields: {
                'System.ChangedDate': createdDate,
                'System.ChangedBy': 'Creator',
                'System.AreaPath': 'Team A'
              }
            }
          ]
        }
      });

      const result = await getLastSubstantiveChange({
        workItemId: 999
      });

      // Creation is always substantive, so allChangesWereAutomated checks if all NON-creation changes were automated
      // With 2 revisions, if only rev 1 (creation) is substantive, then 1 automated change was skipped
      // but allChangesWereAutomated is false because creation counts as substantive
      expect(result.lastSubstantiveChange).toBe(createdDate);
      expect(result.automatedChangesSkipped).toBe(1);
      expect(result.allChangesWereAutomated).toBe(false); // Creation is substantive
      expect(result.lastChangeType).toBe('Creation');
    });

    it('should skip stack rank changes as non-substantive', async () => {
      const createdDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
      const rankChange = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const commentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          id: 111,
          fields: {
            'System.CreatedDate': createdDate
          }
        }
      });

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          value: [
            {
              rev: 3,
              fields: {
                'System.ChangedDate': rankChange,
                'System.ChangedBy': 'System',
                'Microsoft.VSTS.Common.StackRank': 1000,
                'System.History': 'Added implementation notes'  // History unchanged from rev 2
              }
            },
            {
              rev: 2,
              fields: {
                'System.ChangedDate': commentDate,
                'System.ChangedBy': 'Developer',
                'System.History': 'Added implementation notes',
                'Microsoft.VSTS.Common.StackRank': 500
              }
            },
            {
              rev: 1,
              fields: {
                'System.ChangedDate': createdDate,
                'System.ChangedBy': 'Creator',
                'Microsoft.VSTS.Common.StackRank': 500,
                'System.History': ''
              }
            }
          ]
        }
      });

      const result = await getLastSubstantiveChange({
        workItemId: 111
      });

      // Rev 2 added History comment (substantive)
      expect(result.lastSubstantiveChange).toBe(commentDate);
      expect(result.daysInactive).toBe(5);
      expect(result.automatedChangesSkipped).toBe(1);
      expect(result.lastChangeType).toContain('History');
    });
  });

  describe('Automated account detection', () => {
    it('should recognize Project Collection Build Service as automated', async () => {
      const createdDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const buildChange = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          id: 222,
          fields: {
            'System.CreatedDate': createdDate
          }
        }
      });

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          value: [
            {
              rev: 2,
              fields: {
                'System.ChangedDate': buildChange,
                'System.ChangedBy': 'Project Collection Build Service (organization)',
                'System.IterationPath': 'Sprint 3'
              }
            },
            {
              rev: 1,
              fields: {
                'System.ChangedDate': createdDate,
                'System.ChangedBy': 'User',
                'System.IterationPath': 'Sprint 2'
              }
            }
          ]
        }
      });

      const result = await getLastSubstantiveChange({
        workItemId: 222
      });

      // Creation is substantive, so with 2 revisions (1 automated change + 1 creation),
      // allChangesWereAutomated is false
      expect(result.automatedChangesSkipped).toBe(1);
      expect(result.allChangesWereAutomated).toBe(false);
    });

    it('should support custom automation patterns', async () => {
      const createdDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const botChange = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          id: 333,
          fields: {
            'System.CreatedDate': createdDate
          }
        }
      });

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          value: [
            {
              rev: 2,
              fields: {
                'System.ChangedDate': botChange,
                'System.ChangedBy': 'MyCustomBot',
                'System.AreaPath': 'New Area'
              }
            },
            {
              rev: 1,
              fields: {
                'System.ChangedDate': createdDate,
                'System.ChangedBy': 'Human',
                'System.AreaPath': 'Old Area'
              }
            }
          ]
        }
      });

      const result = await getLastSubstantiveChange({
        workItemId: 333,
        automatedPatterns: ['MyCustomBot']
      });

      expect(result.automatedChangesSkipped).toBe(1);
    });
  });

  describe('Multiple field changes', () => {
    it('should combine multiple substantive field names in change type', async () => {
      const createdDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
      const multiChange = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          id: 444,
          fields: {
            'System.CreatedDate': createdDate
          }
        }
      });

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          value: [
            {
              rev: 2,
              fields: {
                'System.ChangedDate': multiChange,
                'System.ChangedBy': 'Developer',
                'System.Title': 'New Title',
                'System.Description': 'New Description',
                'System.State': 'Active'
              }
            },
            {
              rev: 1,
              fields: {
                'System.ChangedDate': createdDate,
                'System.ChangedBy': 'Creator',
                'System.Title': 'Old Title',
                'System.Description': 'Old Description',
                'System.State': 'New'
              }
            }
          ]
        }
      });

      const result = await getLastSubstantiveChange({
        workItemId: 444
      });

      expect(result.lastSubstantiveChange).toBe(multiChange);
      expect(result.lastChangeType).toContain('Title');
      expect(result.lastChangeType).toContain('Description');
      expect(result.lastChangeType).toContain('State');
    });
  });

  describe('Edge cases', () => {
    it('should handle work items with no revisions', async () => {
      const createdDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          id: 555,
          fields: {
            'System.CreatedDate': createdDate
          }
        }
      });

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          value: []
        }
      });

      const result = await getLastSubstantiveChange({
        workItemId: 555
      });

      expect(result.lastSubstantiveChange).toBeNull();
      expect(result.lastChangeType).toBe('No history');
      expect(result.daysSinceCreation).toBe(5);
    });

    it('should handle API errors gracefully', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('API Error'));

      await expect(getLastSubstantiveChange({
        workItemId: 666
      })).rejects.toThrow('API Error');
    });

    it('should use custom history count parameter', async () => {
      const createdDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          id: 777,
          fields: {
            'System.CreatedDate': createdDate
          }
        }
      });

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          value: []
        }
      });

      await getLastSubstantiveChange({
        workItemId: 777,
        historyCount: 100
      });

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('=100')
      );
    });

    it('should use provided organization and project', async () => {
      const createdDate = new Date().toISOString();

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          id: 888,
          fields: {
            'System.CreatedDate': createdDate
          }
        }
      });

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          value: []
        }
      });

      await getLastSubstantiveChange({
        workItemId: 888,
        organization: 'custom-org',
        project: 'custom-project'
      });

      expect(createADOHttpClient).toHaveBeenCalledWith('custom-org', expect.any(Function), 'custom-project');
    });
  });

  describe('ChangedBy field handling', () => {
    it('should handle ChangedBy as object with displayName', async () => {
      const createdDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const changeDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          id: 999,
          fields: {
            'System.CreatedDate': createdDate
          }
        }
      });

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          value: [
            {
              rev: 2,
              fields: {
                'System.ChangedDate': changeDate,
                'System.ChangedBy': { displayName: 'Azure DevOps Service' },
                'System.IterationPath': 'New Sprint'
              }
            },
            {
              rev: 1,
              fields: {
                'System.ChangedDate': createdDate,
                'System.ChangedBy': { displayName: 'User' },
                'System.IterationPath': 'Old Sprint'
              }
            }
          ]
        }
      });

      const result = await getLastSubstantiveChange({
        workItemId: 999
      });

      expect(result.automatedChangesSkipped).toBe(1);
    });
  });
});
