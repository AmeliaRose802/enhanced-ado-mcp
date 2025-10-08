/**
 * Unit tests for WorkItemRepository
 */

import { WorkItemRepository } from '../repositories/work-item.repository.js';
import type { ADOWorkItem, ADORepository, ADOWorkItemRevision, ADOApiResponse, ADOWiqlResult } from '../types/index.js';

// Mock the ado-token module
jest.mock('../utils/ado-token.js', () => ({
  getAzureDevOpsToken: jest.fn(() => 'mock-token'),
  clearTokenCache: jest.fn()
}));

describe('WorkItemRepository', () => {
  let repository: WorkItemRepository;
  const mockOrganization = 'test-org';
  const mockProject = 'test-project';

  beforeEach(() => {
    repository = new WorkItemRepository(mockOrganization, mockProject);
  });

  describe('getById', () => {
    it('should fetch a work item by ID without fields', async () => {
      const mockWorkItem: ADOWorkItem = {
        id: 123,
        rev: 1,
        fields: {
          'System.Id': 123,
          'System.Title': 'Test Item',
          'System.WorkItemType': 'Task',
          'System.State': 'Active'
        }
      };

      // Mock the httpClient.get method
      const getSpy = jest.spyOn((repository as any).httpClient, 'get');
      getSpy.mockResolvedValue({ data: mockWorkItem });

      const result = await repository.getById(123);

      expect(result).toEqual(mockWorkItem);
      expect(getSpy).toHaveBeenCalledWith('wit/workitems/123');
      getSpy.mockRestore();
    });

    it('should fetch a work item by ID with specific fields', async () => {
      const mockWorkItem: ADOWorkItem = {
        id: 123,
        rev: 1,
        fields: {
          'System.Id': 123,
          'System.Title': 'Test Item',
          'System.WorkItemType': 'Task',
          'System.State': 'Active'
        }
      };

      const getSpy = jest.spyOn((repository as any).httpClient, 'get');
      getSpy.mockResolvedValue({ data: mockWorkItem });

      const result = await repository.getById(123, ['System.Title', 'System.State']);

      expect(result).toEqual(mockWorkItem);
      expect(getSpy).toHaveBeenCalledWith(expect.stringContaining('fields='));
      getSpy.mockRestore();
    });
  });

  describe('getBatch', () => {
    it('should fetch multiple work items by IDs', async () => {
      const mockWorkItems: ADOWorkItem[] = [
        {
          id: 123,
          rev: 1,
          fields: {
            'System.Id': 123,
            'System.Title': 'Test Item 1',
            'System.WorkItemType': 'Task',
            'System.State': 'Active'
          }
        },
        {
          id: 124,
          rev: 1,
          fields: {
            'System.Id': 124,
            'System.Title': 'Test Item 2',
            'System.WorkItemType': 'Task',
            'System.State': 'Active'
          }
        }
      ];

      const getSpy = jest.spyOn((repository as any).httpClient, 'get');
      getSpy.mockResolvedValue({ data: { value: mockWorkItems } });

      const result = await repository.getBatch([123, 124]);

      expect(result).toEqual(mockWorkItems);
      expect(getSpy).toHaveBeenCalledWith(expect.stringContaining('ids=123,124'));
      getSpy.mockRestore();
    });

    it('should handle empty batch response', async () => {
      const getSpy = jest.spyOn((repository as any).httpClient, 'get');
      getSpy.mockResolvedValue({ data: {} });

      const result = await repository.getBatch([123, 124]);

      expect(result).toEqual([]);
      getSpy.mockRestore();
    });
  });

  describe('create', () => {
    it('should create a work item with provided fields', async () => {
      const mockWorkItem: ADOWorkItem = {
        id: 125,
        rev: 1,
        fields: {
          'System.Id': 125,
          'System.Title': 'New Item',
          'System.WorkItemType': 'Task',
          'System.State': 'New'
        }
      };

      const postSpy = jest.spyOn((repository as any).httpClient, 'post');
      postSpy.mockResolvedValue({ data: mockWorkItem });

      const fields = [
        { op: 'add' as const, path: '/fields/System.Title', value: 'New Item' }
      ];

      const result = await repository.create('Task', fields);

      expect(result).toEqual(mockWorkItem);
      expect(postSpy).toHaveBeenCalledWith('wit/workitems/$Task', fields);
      postSpy.mockRestore();
    });

    it('should URL-encode work item type with spaces', async () => {
      const mockWorkItem: ADOWorkItem = {
        id: 125,
        rev: 1,
        fields: {
          'System.Id': 125,
          'System.Title': 'New Item',
          'System.WorkItemType': 'Product Backlog Item',
          'System.State': 'New'
        }
      };

      const postSpy = jest.spyOn((repository as any).httpClient, 'post');
      postSpy.mockResolvedValue({ data: mockWorkItem });

      const fields = [
        { op: 'add' as const, path: '/fields/System.Title', value: 'New Item' }
      ];

      await repository.create('Product Backlog Item', fields);

      expect(postSpy).toHaveBeenCalledWith(
        'wit/workitems/$Product%20Backlog%20Item',
        fields
      );
      postSpy.mockRestore();
    });
  });

  describe('update', () => {
    it('should update a work item with provided fields', async () => {
      const mockWorkItem: ADOWorkItem = {
        id: 123,
        rev: 2,
        fields: {
          'System.Id': 123,
          'System.Title': 'Updated Item',
          'System.WorkItemType': 'Task',
          'System.State': 'Active'
        }
      };

      const patchSpy = jest.spyOn((repository as any).httpClient, 'patch');
      patchSpy.mockResolvedValue({ data: mockWorkItem });

      const fields = [
        { op: 'replace' as const, path: '/fields/System.Title', value: 'Updated Item' }
      ];

      const result = await repository.update(123, fields);

      expect(result).toEqual(mockWorkItem);
      expect(patchSpy).toHaveBeenCalledWith('wit/workitems/123', fields);
      patchSpy.mockRestore();
    });
  });

  describe('delete', () => {
    it('should soft delete a work item', async () => {
      const deleteSpy = jest.spyOn((repository as any).httpClient, 'delete');
      deleteSpy.mockResolvedValue({ data: {} });

      await repository.delete(123, false);

      expect(deleteSpy).toHaveBeenCalledWith('wit/workitems/123');
      deleteSpy.mockRestore();
    });

    it('should hard delete a work item', async () => {
      const deleteSpy = jest.spyOn((repository as any).httpClient, 'delete');
      deleteSpy.mockResolvedValue({ data: {} });

      await repository.delete(123, true);

      expect(deleteSpy).toHaveBeenCalledWith('wit/workitems/123?destroy=true');
      deleteSpy.mockRestore();
    });
  });

  describe('linkToParent', () => {
    it('should create parent link relation', async () => {
      const patchSpy = jest.spyOn((repository as any).httpClient, 'patch');
      patchSpy.mockResolvedValue({ data: {} });

      await repository.linkToParent(123, 100);

      expect(patchSpy).toHaveBeenCalledWith(
        'wit/workitems/123',
        expect.arrayContaining([
          expect.objectContaining({
            op: 'add',
            path: '/relations/-',
            value: expect.objectContaining({
              rel: 'System.LinkTypes.Hierarchy-Reverse'
            })
          })
        ])
      );
      patchSpy.mockRestore();
    });
  });

  describe('linkToBranch', () => {
    it('should create branch artifact link', async () => {
      const patchSpy = jest.spyOn((repository as any).httpClient, 'patch');
      patchSpy.mockResolvedValue({ data: {} });

      await repository.linkToBranch(123, 'proj-id', 'repo-id', 'main', 'test-repo');

      expect(patchSpy).toHaveBeenCalledWith(
        'wit/workitems/123',
        expect.arrayContaining([
          expect.objectContaining({
            op: 'add',
            path: '/relations/-',
            value: expect.objectContaining({
              rel: 'ArtifactLink',
              url: expect.stringContaining('vstfs:///Git/Ref/')
            })
          })
        ])
      );
      patchSpy.mockRestore();
    });
  });

  describe('getRevisions', () => {
    it('should fetch work item revisions', async () => {
      const mockRevisions: ADOWorkItemRevision[] = [
        {
          id: 123,
          rev: 2,
          fields: {
            'System.Id': 123,
            'System.Title': 'Test Item',
            'System.WorkItemType': 'Task',
            'System.State': 'Active'
          },
          url: 'https://dev.azure.com/test-org/test-project/_apis/wit/workItems/123/revisions/2'
        },
        {
          id: 123,
          rev: 1,
          fields: {
            'System.Id': 123,
            'System.Title': 'Test Item',
            'System.WorkItemType': 'Task',
            'System.State': 'New'
          },
          url: 'https://dev.azure.com/test-org/test-project/_apis/wit/workItems/123/revisions/1'
        }
      ];

      const getSpy = jest.spyOn((repository as any).httpClient, 'get');
      getSpy.mockResolvedValue({ data: { value: mockRevisions } });

      const result = await repository.getRevisions(123, 10);

      expect(result).toEqual(mockRevisions);
      expect(getSpy).toHaveBeenCalledWith('wit/workItems/123/revisions?$top=10');
      getSpy.mockRestore();
    });
  });

  describe('executeWiql', () => {
    it('should execute a WIQL query', async () => {
      const mockWiqlResult: ADOWiqlResult = {
        queryType: 'flat',
        queryResultType: 'workItem',
        asOf: new Date().toISOString(),
        columns: [
          { referenceName: 'System.Id', name: 'ID' },
          { referenceName: 'System.Title', name: 'Title' }
        ],
        workItems: [
          { id: 123, url: '' },
          { id: 124, url: '' }
        ]
      };

      const postSpy = jest.spyOn((repository as any).httpClient, 'post');
      postSpy.mockResolvedValue({ data: mockWiqlResult });

      const query = 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = "Active"';
      const result = await repository.executeWiql(query);

      expect(result).toEqual(mockWiqlResult);
      expect(postSpy).toHaveBeenCalledWith('wit/wiql', { query });
      postSpy.mockRestore();
    });
  });

  describe('getRepository', () => {
    it('should fetch repository by exact match', async () => {
      const mockRepo: ADORepository = {
        id: 'repo-id',
        name: 'test-repo',
        url: 'https://dev.azure.com/test-org/test-project/_git/test-repo',
        project: {
          id: 'proj-id',
          name: 'test-project'
        }
      };

      const getSpy = jest.spyOn((repository as any).httpClient, 'get');
      getSpy.mockResolvedValue({ data: mockRepo });

      const result = await repository.getRepository('test-repo');

      expect(result).toEqual(mockRepo);
      expect(getSpy).toHaveBeenCalledWith('git/repositories/test-repo');
      getSpy.mockRestore();
    });

    it('should search for repository by name if exact match fails', async () => {
      const mockRepo: ADORepository = {
        id: 'repo-id',
        name: 'test-repo',
        url: 'https://dev.azure.com/test-org/test-project/_git/test-repo',
        project: {
          id: 'proj-id',
          name: 'test-project'
        }
      };

      const getSpy = jest.spyOn((repository as any).httpClient, 'get');
      // First call fails, second call returns list
      getSpy.mockRejectedValueOnce(new Error('Not found'));
      getSpy.mockResolvedValueOnce({ data: { value: [mockRepo] } });

      const result = await repository.getRepository('test-repo');

      expect(result).toEqual(mockRepo);
      expect(getSpy).toHaveBeenCalledTimes(2);
      getSpy.mockRestore();
    });

    it('should throw error if repository not found', async () => {
      const getSpy = jest.spyOn((repository as any).httpClient, 'get');
      getSpy.mockRejectedValueOnce(new Error('Not found'));
      getSpy.mockResolvedValueOnce({ data: { value: [] } });

      await expect(repository.getRepository('nonexistent-repo')).rejects.toThrow(
        /Repository 'nonexistent-repo' not found/
      );

      getSpy.mockRestore();
    });
  });
});
