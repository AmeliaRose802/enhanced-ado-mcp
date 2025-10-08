/**
 * Item Context Enrichment Tests
 *
 * Tests for rich item context storage in query handles including:
 * - Index storage (0-based array position)
 * - ID, title, state, type extraction
 * - daysInactive calculation
 * - lastChange fallback logic (substantiveChange -> changedDate)
 * - Tags parsing from System.Tags field
 */

import { queryHandleService } from "../services/query-handle-service.js";

describe("Item Context Enrichment", () => {
  beforeEach(() => {
    queryHandleService.clearAll();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe("Rich itemContext storage", () => {
    it("should store complete itemContext with all required fields", () => {
      const workItemIds = [100, 200, 300];
      const query = "SELECT [System.Id] FROM WorkItems";

      const workItemContext = new Map();
      workItemContext.set(100, {
        title: "Feature: User Authentication",
        state: "Active",
        type: "Feature",
        daysInactive: 15,
        lastSubstantiveChangeDate: "2025-01-10T14:30:00Z",
        changedDate: "2025-01-15T10:00:00Z",
        tags: "security;authentication;high-priority",
      });
      workItemContext.set(200, {
        title: "Bug: Login fails on mobile",
        state: "New",
        type: "Bug",
        daysInactive: 5,
        lastSubstantiveChangeDate: "2025-01-20T08:15:00Z",
        changedDate: "2025-01-20T08:15:00Z",
        tags: "mobile;bug;urgent",
      });
      workItemContext.set(300, {
        title: "Task: Update documentation",
        state: "Done",
        type: "Task",
        changedDate: "2025-01-18T16:45:00Z",
        tags: "docs",
      });

      const handle = queryHandleService.storeQuery(
        workItemIds,
        query,
        undefined,
        60000,
        workItemContext
      );

      const data = queryHandleService.getQueryData(handle);
      expect(data).not.toBeNull();
      expect(data?.itemContext).toHaveLength(3);

      // Verify first item with all fields
      const item1 = data?.itemContext[0];
      expect(item1).toEqual({
        index: 0,
        id: 100,
        title: "Feature: User Authentication",
        state: "Active",
        type: "Feature",
        daysInactive: 15,
        lastChange: "2025-01-10T14:30:00Z", // Uses substantive change
        tags: ["security", "authentication", "high-priority"],
      });

      // Verify second item
      const item2 = data?.itemContext[1];
      expect(item2).toEqual({
        index: 1,
        id: 200,
        title: "Bug: Login fails on mobile",
        state: "New",
        type: "Bug",
        daysInactive: 5,
        lastChange: "2025-01-20T08:15:00Z",
        tags: ["mobile", "bug", "urgent"],
      });

      // Verify third item without substantive change (uses changedDate fallback)
      const item3 = data?.itemContext[2];
      expect(item3).toEqual({
        index: 2,
        id: 300,
        title: "Task: Update documentation",
        state: "Done",
        type: "Task",
        daysInactive: undefined,
        lastChange: "2025-01-18T16:45:00Z", // Falls back to changedDate
        tags: ["docs"],
      });
    });

    it("should handle lastChange fallback when substantive change unavailable", () => {
      const workItemIds = [500];
      const query = "SELECT [System.Id] FROM WorkItems";

      const workItemContext = new Map();
      workItemContext.set(500, {
        title: "Item without substantive change",
        state: "New",
        type: "Task",
        changedDate: "2025-01-22T12:00:00Z",
        tags: "",
      });

      const handle = queryHandleService.storeQuery(
        workItemIds,
        query,
        undefined,
        60000,
        workItemContext
      );

      const data = queryHandleService.getQueryData(handle);
      const item = data?.itemContext[0];

      expect(item?.lastChange).toBe("2025-01-22T12:00:00Z");
    });

    it("should parse tags from semicolon-separated string", () => {
      const workItemIds = [600];
      const query = "SELECT [System.Id] FROM WorkItems";

      const workItemContext = new Map();
      workItemContext.set(600, {
        title: "Multi-tag item",
        state: "Active",
        type: "Feature",
        changedDate: "2025-01-01T00:00:00Z",
        tags: "frontend; backend ; database;security",
      });

      const handle = queryHandleService.storeQuery(
        workItemIds,
        query,
        undefined,
        60000,
        workItemContext
      );

      const data = queryHandleService.getQueryData(handle);
      const item = data?.itemContext[0];

      expect(item?.tags).toEqual(["frontend", "backend", "database", "security"]);
    });

    it("should handle empty or missing tags", () => {
      const workItemIds = [700, 800];
      const query = "SELECT [System.Id] FROM WorkItems";

      const workItemContext = new Map();
      workItemContext.set(700, {
        title: "No tags",
        state: "New",
        type: "Task",
        changedDate: "2025-01-01T00:00:00Z",
        tags: "",
      });
      workItemContext.set(800, {
        title: "Missing tags field",
        state: "New",
        type: "Task",
        changedDate: "2025-01-01T00:00:00Z",
      });

      const handle = queryHandleService.storeQuery(
        workItemIds,
        query,
        undefined,
        60000,
        workItemContext
      );

      const data = queryHandleService.getQueryData(handle);

      expect(data?.itemContext[0].tags).toBeUndefined();
      expect(data?.itemContext[1].tags).toBeUndefined();
    });

    it("should maintain zero-based indices correctly", () => {
      const workItemIds = [1001, 1002, 1003, 1004, 1005];
      const query = "SELECT [System.Id] FROM WorkItems";

      const workItemContext = new Map();
      workItemIds.forEach((id) => {
        workItemContext.set(id, {
          title: `Item ${id}`,
          state: "Active",
          type: "Task",
          changedDate: "2025-01-01T00:00:00Z",
          tags: "",
        });
      });

      const handle = queryHandleService.storeQuery(
        workItemIds,
        query,
        undefined,
        60000,
        workItemContext
      );

      const data = queryHandleService.getQueryData(handle);

      expect(data?.itemContext).toHaveLength(5);
      data?.itemContext.forEach((item, idx) => {
        expect(item.index).toBe(idx);
        expect(item.id).toBe(workItemIds[idx]);
      });
    });
  });

  describe("Selection metadata generation", () => {
    it("should generate selectionMetadata with correct structure", () => {
      const workItemIds = [101, 102, 103];
      const query = "SELECT [System.Id] FROM WorkItems";

      const workItemContext = new Map();
      workItemContext.set(101, {
        title: "Item 1",
        state: "New",
        type: "Bug",
        changedDate: "2025-01-01T00:00:00Z",
        tags: "bug;critical",
      });
      workItemContext.set(102, {
        title: "Item 2",
        state: "Active",
        type: "Task",
        changedDate: "2025-01-01T00:00:00Z",
        tags: "task;medium",
      });
      workItemContext.set(103, {
        title: "Item 3",
        state: "Done",
        type: "Feature",
        changedDate: "2025-01-01T00:00:00Z",
        tags: "feature;bug", // Overlapping tag
      });

      const handle = queryHandleService.storeQuery(
        workItemIds,
        query,
        undefined,
        60000,
        workItemContext
      );

      const data = queryHandleService.getQueryData(handle);

      expect(data?.selectionMetadata).toEqual({
        totalItems: 3,
        selectableIndices: [0, 1, 2],
        criteriaTags: ["bug", "critical", "task", "medium", "feature"],
      });
    });

    it("should deduplicate tags in criteriaTags", () => {
      const workItemIds = [201, 202, 203];
      const query = "SELECT [System.Id] FROM WorkItems";

      const workItemContext = new Map();
      workItemContext.set(201, {
        title: "Item 1",
        state: "New",
        type: "Bug",
        changedDate: "2025-01-01T00:00:00Z",
        tags: "urgent;bug",
      });
      workItemContext.set(202, {
        title: "Item 2",
        state: "Active",
        type: "Bug",
        changedDate: "2025-01-01T00:00:00Z",
        tags: "bug;urgent", // Same tags, different order
      });
      workItemContext.set(203, {
        title: "Item 3",
        state: "New",
        type: "Task",
        changedDate: "2025-01-01T00:00:00Z",
        tags: "urgent",
      });

      const handle = queryHandleService.storeQuery(
        workItemIds,
        query,
        undefined,
        60000,
        workItemContext
      );

      const data = queryHandleService.getQueryData(handle);

      // Should have only unique tags
      expect(data?.selectionMetadata.criteriaTags).toHaveLength(2);
      expect(data?.selectionMetadata.criteriaTags).toContain("urgent");
      expect(data?.selectionMetadata.criteriaTags).toContain("bug");
    });

    it("should handle items with no tags in metadata", () => {
      const workItemIds = [301, 302];
      const query = "SELECT [System.Id] FROM WorkItems";

      const workItemContext = new Map();
      workItemContext.set(301, {
        title: "No tags item",
        state: "New",
        type: "Task",
        changedDate: "2025-01-01T00:00:00Z",
        tags: "",
      });
      workItemContext.set(302, {
        title: "Also no tags",
        state: "Active",
        type: "Task",
        changedDate: "2025-01-01T00:00:00Z",
        tags: "",
      });

      const handle = queryHandleService.storeQuery(
        workItemIds,
        query,
        undefined,
        60000,
        workItemContext
      );

      const data = queryHandleService.getQueryData(handle);

      expect(data?.selectionMetadata.criteriaTags).toEqual([]);
    });
  });

  describe("Default values for missing data", () => {
    it("should use default values when context is missing", () => {
      const workItemIds = [999];
      const query = "SELECT [System.Id] FROM WorkItems";

      // No workItemContext provided
      const handle = queryHandleService.storeQuery(workItemIds, query, undefined, 60000);

      const data = queryHandleService.getQueryData(handle);
      const item = data?.itemContext[0];

      expect(item).toEqual({
        index: 0,
        id: 999,
        title: "Work Item 999",
        state: "Unknown",
        type: "Unknown",
        daysInactive: undefined,
        lastChange: undefined,
        tags: undefined,
      });
    });

    it("should use partial context when only some fields provided", () => {
      const workItemIds = [888];
      const query = "SELECT [System.Id] FROM WorkItems";

      const workItemContext = new Map();
      workItemContext.set(888, {
        title: "Partial context item",
        state: "Active",
        type: "Task",
        // Missing: daysInactive, lastSubstantiveChangeDate, changedDate, tags
      });

      const handle = queryHandleService.storeQuery(
        workItemIds,
        query,
        undefined,
        60000,
        workItemContext
      );

      const data = queryHandleService.getQueryData(handle);
      const item = data?.itemContext[0];

      expect(item).toEqual({
        index: 0,
        id: 888,
        title: "Partial context item",
        state: "Active",
        type: "Task",
        daysInactive: undefined,
        lastChange: undefined,
        tags: undefined,
      });
    });
  });
});
