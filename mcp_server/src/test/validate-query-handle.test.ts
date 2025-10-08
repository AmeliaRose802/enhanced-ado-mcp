/**
 * Validate Query Handle Handler Tests
 *
 * Tests for the validate-query-handle handler that validates and retrieves
 * metadata about stored query handles.
 */

import { handleValidateQueryHandle } from "../services/handlers/query-handles/validate-query-handle.handler.js";
import { queryHandleService } from "../services/query-handle-service.js";
import { validateQueryHandleSchema } from "../config/schemas.js";

// Mock configuration
jest.mock("../config/config.js", () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: "test-org",
      project: "test-project",
      areaPath: "",
      iterationPath: "",
      defaultWorkItemType: "Task",
      defaultPriority: 2,
      defaultAssignedTo: "",
      inheritParentPaths: false,
    },
  })),
  updateConfigFromCLI: jest.fn(),
}));

// Mock Azure CLI validation
jest.mock("../services/ado-discovery-service.js", () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true,
  })),
}));

// Mock ADO HTTP Client
jest.mock("../utils/ado-http-client.js", () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue({
      data: {
        id: 12345,
        fields: {
          "System.Title": "Test Item",
          "System.WorkItemType": "Task",
          "System.State": "Active",
        },
      },
    }),
  })),
}));

describe("Validate Query Handle Handler", () => {
  const mockConfig = {
    name: "wit-query-handle-validate",
    description: "Test",
    script: "",
    schema: validateQueryHandleSchema,
    inputSchema: { type: "object" as const },
  };

  beforeEach(() => {
    queryHandleService.clearAll();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  it("should validate an existing query handle", async () => {
    const workItemIds = [12345, 67890];
    const query = 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = "Active"';
    const handle = queryHandleService.storeQuery(workItemIds, query);

    const result = await handleValidateQueryHandle(mockConfig, {
      queryHandle: handle,
      includeSampleItems: false,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.valid).toBe(true);
    expect(result.data.item_count).toBe(2);
    expect(result.data.query_handle).toBe(handle);
    expect(result.data.original_query).toBe(query);
    expect(result.data.time_remaining_minutes).toBeGreaterThan(0);
  });

  it("should return error for non-existent query handle", async () => {
    const result = await handleValidateQueryHandle(mockConfig, {
      queryHandle: "qh_nonexistent",
    });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("not found");
    expect(result.metadata.errorCategory).toBe("not-found");
  });

  it("should return error for expired query handle", async () => {
    const workItemIds = [12345];
    const query = "SELECT [System.Id] FROM WorkItems";
    // Store with very short TTL (1ms)
    const handle = queryHandleService.storeQuery(workItemIds, query, undefined, 1);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 10));

    const result = await handleValidateQueryHandle(mockConfig, {
      queryHandle: handle,
    });

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("not found");
    expect(result.metadata.errorCategory).toBe("not-found");
  });

  it("should include metadata when present", async () => {
    const workItemIds = [12345];
    const query = "SELECT [System.Id] FROM WorkItems";
    const metadata = { project: "TestProject", queryType: "wiql" };
    const handle = queryHandleService.storeQuery(workItemIds, query, metadata);

    const result = await handleValidateQueryHandle(mockConfig, {
      queryHandle: handle,
    });

    expect(result.success).toBe(true);
    expect(result.data.metadata).toEqual(metadata);
  });

  it("should include sample items when requested", async () => {
    const workItemIds = [12345, 67890, 11111];
    const query = "SELECT [System.Id] FROM WorkItems";
    const handle = queryHandleService.storeQuery(workItemIds, query);

    const result = await handleValidateQueryHandle(mockConfig, {
      queryHandle: handle,
      includeSampleItems: true,
      organization: "test-org",
      project: "test-project",
    });

    expect(result.success).toBe(true);
    expect(result.data.sample_items).toBeDefined();
    expect(Array.isArray(result.data.sample_items)).toBe(true);
  });

  it("should limit sample items to 5", async () => {
    const workItemIds = [1, 2, 3, 4, 5, 6, 7, 8];
    const query = "SELECT [System.Id] FROM WorkItems";
    const handle = queryHandleService.storeQuery(workItemIds, query);

    const result = await handleValidateQueryHandle(mockConfig, {
      queryHandle: handle,
      includeSampleItems: true,
      organization: "test-org",
      project: "test-project",
    });

    expect(result.success).toBe(true);
    expect(result.data.sample_note).toContain("Showing first 5 of 8 items");
  });
});
