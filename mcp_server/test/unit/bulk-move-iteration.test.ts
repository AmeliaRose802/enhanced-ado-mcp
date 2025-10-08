/**
 * Bulk Move to Iteration Handler Tests
 *
 * Tests for the wit-bulk-move-to-iteration-by-query-handle tool
 * that moves work items to different iterations/sprints.
 */

import { handleBulkMoveToIteration } from "../../src/services/handlers/bulk-operations/bulk-move-iteration-handler";
import { queryHandleService } from "../../src/services/query-handle-service";
import { bulkMoveToIterationByQueryHandleSchema } from "../../src/config/schemas";
import type { ToolConfig } from "../../src/types/index";

// Mock dependencies
jest.mock("../../src/services/ado-discovery-service", () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true,
  })),
}));

jest.mock("../../src/utils/ado-http-client", () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue({
      data: {
        value: [
          {
            id: "iteration-id",
            name: "Sprint 11",
            path: "TestProject\\Sprint 11",
          },
        ],
      },
    }),
    patch: jest.fn().mockResolvedValue({
      data: {
        id: 123,
        fields: {
          "System.IterationPath": "TestProject\\Sprint 11",
        },
      },
    }),
  })),
}));

jest.mock("../../src/config/config", () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: "test-org",
      project: "test-project",
    },
  })),
}));

describe("Bulk Move to Iteration Handler", () => {
  const mockConfig: ToolConfig = {
    name: "wit-bulk-move-to-iteration",
    description: "Test tool",
    script: "",
    schema: bulkMoveToIterationByQueryHandleSchema,
    inputSchema: { type: "object" as const },
  };

  beforeEach(() => {
    queryHandleService.clearAll();
    jest.clearAllMocks();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe("Iteration path validation", () => {
    it("should validate iteration path exists", async () => {
      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [
          101,
          {
            title: "Task 1",
            state: "Active",
            type: "Task",
            iterationPath: "TestProject\\Sprint 10",
          },
        ],
        [
          102,
          {
            title: "Task 2",
            state: "Active",
            type: "Task",
            iterationPath: "TestProject\\Sprint 10",
          },
        ],
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: "all",
        dryRun: true,
      });

      expect(result.success).toBe(true);
    });

    it("should return error for invalid iteration path", async () => {
      const { ADOHttpClient } = require("../../src/utils/ado-http-client");
      ADOHttpClient.mockImplementation(() => ({
        get: jest.fn().mockRejectedValue(new Error("Iteration not found")),
      }));

      const workItemIds = [101];
      const workItemContext = new Map([[101, { title: "Task 1", state: "Active", type: "Task" }]]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\InvalidSprint",
        itemSelector: "all",
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining("Invalid iteration path")])
      );
    });
  });

  describe("Item selection", () => {
    it("should move only selected items by index", async () => {
      const workItemIds = [101, 102, 103, 104, 105];
      const workItemContext = new Map(
        workItemIds.map((id) => [
          id,
          {
            title: `Task ${id}`,
            state: "Active",
            type: "Task",
            iterationPath: "TestProject\\Sprint 10",
          },
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: [1, 3], // Select 2nd and 4th items
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.selected_items_count).toBe(2);
      expect(result.data.total_items_in_handle).toBe(5);
    });

    it("should move items matching criteria", async () => {
      const workItemIds = [101, 102, 103, 104];
      const workItemContext = new Map([
        [101, { title: "Task 1", state: "Active", type: "Task", tags: "frontend" }],
        [102, { title: "Task 2", state: "Done", type: "Task", tags: "backend" }],
        [103, { title: "Task 3", state: "Active", type: "Task", tags: "frontend" }],
        [104, { title: "Task 4", state: "Active", type: "Task", tags: "backend" }],
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: { states: ["Active"], tags: ["frontend"] },
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.selected_items_count).toBe(2); // Tasks 1 and 3
    });

    it('should move all items when selector is "all"', async () => {
      const workItemIds = [101, 102, 103];
      const workItemContext = new Map(
        workItemIds.map((id) => [id, { title: `Task ${id}`, state: "Active", type: "Task" }])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: "all",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.selected_items_count).toBe(3);
    });
  });

  describe("Dry run mode", () => {
    it("should show preview without making changes", async () => {
      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [
          101,
          {
            title: "Task 1",
            state: "Active",
            type: "Task",
            iterationPath: "TestProject\\Sprint 10",
          },
        ],
        [
          102,
          {
            title: "Task 2",
            state: "Active",
            type: "Task",
            iterationPath: "TestProject\\Sprint 10",
          },
        ],
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: "all",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.dry_run).toBe(true);
      expect(result.data.preview).toBeDefined();
      expect(result.data.preview).toHaveLength(2);
      expect(result.warnings).toContain("Dry run mode - no changes made");
    });

    it("should limit preview to maxPreviewItems", async () => {
      const workItemIds = Array.from({ length: 15 }, (_, i) => 101 + i);
      const workItemContext = new Map(
        workItemIds.map((id) => [
          id,
          {
            title: `Task ${id}`,
            state: "Active",
            type: "Task",
            iterationPath: "TestProject\\Sprint 10",
          },
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: "all",
        dryRun: true,
        maxPreviewItems: 5,
      });

      expect(result.success).toBe(true);
      expect(result.data.preview).toHaveLength(5);
      expect(result.data.selected_items_count).toBe(15);
    });

    it("should show current iteration path in preview", async () => {
      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [
          101,
          {
            title: "Task 1",
            state: "Active",
            type: "Task",
            iterationPath: "TestProject\\Sprint 10",
          },
        ],
        [
          102,
          { title: "Task 2", state: "Active", type: "Task", iterationPath: "TestProject\\Backlog" },
        ],
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: "all",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.preview[0].current_iteration).toBe("TestProject\\Sprint 10");
      expect(result.data.preview[1].current_iteration).toBe("TestProject\\Backlog");
    });
  });

  describe("Execution mode", () => {
    it("should move work items successfully", async () => {
      const { ADOHttpClient } = require("../../src/utils/ado-http-client");
      const mockPatch = jest.fn().mockResolvedValue({
        data: { id: 101, fields: { "System.IterationPath": "TestProject\\Sprint 11" } },
      });
      ADOHttpClient.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({ data: { value: [{ name: "Sprint 11" }] } }),
        patch: mockPatch,
      }));

      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [101, { title: "Task 1", state: "Active", type: "Task" }],
        [102, { title: "Task 2", state: "Active", type: "Task" }],
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: "all",
        dryRun: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.items_succeeded).toBe(2);
      expect(result.data.items_failed).toBe(0);
      expect(mockPatch).toHaveBeenCalledTimes(2);
    });

    it("should include comment when provided", async () => {
      const { ADOHttpClient } = require("../../src/utils/ado-http-client");
      const mockPatch = jest.fn().mockResolvedValue({
        data: { id: 101, fields: { "System.IterationPath": "TestProject\\Sprint 11" } },
      });
      ADOHttpClient.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({ data: { value: [{ name: "Sprint 11" }] } }),
        patch: mockPatch,
      }));

      const workItemIds = [101];
      const workItemContext = new Map([[101, { title: "Task 1", state: "Active", type: "Task" }]]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        comment: "Moved due to capacity constraints",
        itemSelector: "all",
        dryRun: false,
      });

      const patchCall = mockPatch.mock.calls[0];
      expect(patchCall[1]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "/fields/System.History",
            value: expect.stringContaining("Moved due to capacity constraints"),
          }),
        ])
      );
    });

    it("should handle partial failures", async () => {
      const { ADOHttpClient } = require("../../src/utils/ado-http-client");
      const mockPatch = jest
        .fn()
        .mockResolvedValueOnce({
          data: { id: 101, fields: { "System.IterationPath": "TestProject\\Sprint 11" } },
        })
        .mockRejectedValueOnce(new Error("API Error"));

      ADOHttpClient.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({ data: { value: [{ name: "Sprint 11" }] } }),
        patch: mockPatch,
      }));

      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [101, { title: "Task 1", state: "Active", type: "Task" }],
        [102, { title: "Task 2", state: "Active", type: "Task" }],
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: "all",
        dryRun: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.items_succeeded).toBe(1);
      expect(result.data.items_failed).toBe(1);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining("1 item(s) failed")])
      );
    });
  });

  describe("Child items handling", () => {
    it("should support updating child items", async () => {
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: "Feature 1", state: "Active", type: "Feature" }],
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        updateChildItems: true,
        itemSelector: "all",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.update_child_items).toBe(true);
    });

    it("should default to not updating child items", async () => {
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: "Feature 1", state: "Active", type: "Feature" }],
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: "all",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.update_child_items).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should return error for invalid query handle", async () => {
      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: "qh_invalid",
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: "all",
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining("not found or expired")])
      );
    });

    it("should return error when Azure CLI not available", async () => {
      const { validateAzureCLI } = require("../../src/services/ado-discovery-service");
      validateAzureCLI.mockReturnValueOnce({
        isAvailable: false,
        isLoggedIn: false,
      });

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: "qh_test",
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: "all",
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("Azure CLI")]));
    });

    it("should handle schema validation errors", async () => {
      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: "qh_test",
        // Missing required targetIterationPath
        itemSelector: "all",
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return error when no items selected", async () => {
      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [101, { title: "Task 1", state: "Active", type: "Task" }],
        [102, { title: "Task 2", state: "Active", type: "Task" }],
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000,
        workItemContext
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: { states: ["Done"] }, // No items match
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("No items")]));
    });
  });

  describe("Edge cases", () => {
    it("should handle expired query handles", async () => {
      const workItemIds = [101];
      const workItemContext = new Map([[101, { title: "Task 1", state: "Active", type: "Task" }]]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        1, // Expire immediately
        workItemContext
      );

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: "all",
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("expired")]));
    });

    it("should handle empty workItemContext gracefully", async () => {
      const workItemIds = [101, 102];

      const handle = queryHandleService.storeQuery(
        workItemIds,
        "SELECT [System.Id] FROM WorkItems",
        { project: "TestProject", queryType: "wiql" },
        60000
        // No workItemContext provided
      );

      const result = await handleBulkMoveToIteration(mockConfig, {
        queryHandle: handle,
        targetIterationPath: "TestProject\\Sprint 11",
        itemSelector: "all",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.preview[0].current_iteration).toMatch(/Not set|Unknown/);
    });
  });
});
