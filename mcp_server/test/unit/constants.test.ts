import {
  TOOL_NAMES,
  ERROR_SOURCES,
  WORK_ITEM_STATES,
  COMPLETED_STATES,
  WORK_ITEM_TYPES,
  LINK_TYPES,
  CONFIG_KEYS,
  TIMEOUTS,
  LIMITS,
  HTTP_STATUS,
  FIELD_NAMES,
} from '../../src/constants.js';

describe('Constants', () => {
  describe('TOOL_NAMES', () => {
    it('should have core work item operation names', () => {
      expect(TOOL_NAMES.CREATE_NEW_ITEM).toBe('wit-create-new-item');
      expect(TOOL_NAMES.CLONE_WORK_ITEM).toBe('wit-clone-work-item');
    });

    it('should have query operation names', () => {
      expect(TOOL_NAMES.WIQL_QUERY).toBe('wit-wiql-query');
      expect(TOOL_NAMES.ODATA_ANALYTICS).toBe('wit-query-analytics-odata');
      expect(TOOL_NAMES.GENERATE_ODATA_QUERY).toBe('wit-generate-odata-query');
    });

    it('should have bulk operation names', () => {
      expect(TOOL_NAMES.BULK_ASSIGN_BY_QUERY_HANDLE).toBe('wit-bulk-assign-by-query-handle');
      expect(TOOL_NAMES.BULK_UPDATE_BY_QUERY_HANDLE).toBe('wit-bulk-update-by-query-handle');
    });

    it('should have AI-powered operation names', () => {
      expect(TOOL_NAMES.BULK_ENHANCE_DESCRIPTIONS).toBe('wit-bulk-enhance-descriptions');
      expect(TOOL_NAMES.ANALYZE_BY_QUERY_HANDLE).toBe('wit-analyze-by-query-handle');
    });
  });

  describe('ERROR_SOURCES', () => {
    it('should have standard error sources', () => {
      expect(ERROR_SOURCES.VALIDATION).toBe('validation');
      expect(ERROR_SOURCES.AZURE_CLI).toBe('azure-cli-validation');
      expect(ERROR_SOURCES.WORK_ITEM_NOT_FOUND).toBe('work-item-not-found');
    });
  });

  describe('WORK_ITEM_STATES', () => {
    it('should have standard work item states', () => {
      expect(WORK_ITEM_STATES.NEW).toBe('New');
      expect(WORK_ITEM_STATES.ACTIVE).toBe('Active');
      expect(WORK_ITEM_STATES.DONE).toBe('Done');
      expect(WORK_ITEM_STATES.CLOSED).toBe('Closed');
    });
  });

  describe('COMPLETED_STATES', () => {
    it('should include all completed states', () => {
      expect(COMPLETED_STATES).toContain('Done');
      expect(COMPLETED_STATES).toContain('Completed');
      expect(COMPLETED_STATES).toContain('Closed');
      expect(COMPLETED_STATES).toContain('Resolved');
      expect(COMPLETED_STATES).toContain('Removed');
    });

    it('should have exactly 5 completed states', () => {
      expect(COMPLETED_STATES).toHaveLength(5);
    });
  });

  describe('WORK_ITEM_TYPES', () => {
    it('should have standard work item types', () => {
      expect(WORK_ITEM_TYPES.BUG).toBe('Bug');
      expect(WORK_ITEM_TYPES.TASK).toBe('Task');
      expect(WORK_ITEM_TYPES.USER_STORY).toBe('User Story');
      expect(WORK_ITEM_TYPES.FEATURE).toBe('Feature');
    });
  });

  describe('LINK_TYPES', () => {
    it('should have standard link types', () => {
      expect(LINK_TYPES.PARENT).toBe('System.LinkTypes.Hierarchy-Reverse');
      expect(LINK_TYPES.CHILD).toBe('System.LinkTypes.Hierarchy-Forward');
      expect(LINK_TYPES.RELATED).toBe('System.LinkTypes.Related');
    });
  });

  describe('CONFIG_KEYS', () => {
    it('should have configuration keys', () => {
      expect(CONFIG_KEYS.ORGANIZATION).toBe('organization');
      expect(CONFIG_KEYS.PROJECT).toBe('project');
      expect(CONFIG_KEYS.AREA_PATH).toBe('areaPath');
    });
  });

  describe('TIMEOUTS', () => {
    it('should have timeout values in milliseconds', () => {
      expect(TIMEOUTS.AI_ANALYSIS).toBe(30000);
      expect(TIMEOUTS.API_REQUEST).toBe(30000);
      expect(TIMEOUTS.BULK_OPERATION).toBe(60000);
    });
  });

  describe('LIMITS', () => {
    it('should have operational limits', () => {
      expect(LIMITS.MAX_BATCH_SIZE).toBe(200);
      expect(LIMITS.MAX_RETRIES).toBe(3);
      expect(LIMITS.QUERY_HANDLE_EXPIRATION_HOURS).toBe(1);
    });
  });

  describe('HTTP_STATUS', () => {
    it('should have standard HTTP status codes', () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });

  describe('FIELD_NAMES', () => {
    it('should have system field names', () => {
      expect(FIELD_NAMES.ID).toBe('System.Id');
      expect(FIELD_NAMES.TITLE).toBe('System.Title');
      expect(FIELD_NAMES.STATE).toBe('System.State');
    });

    it('should have Microsoft VSTS field names', () => {
      expect(FIELD_NAMES.PRIORITY).toBe('Microsoft.VSTS.Common.Priority');
      expect(FIELD_NAMES.STORY_POINTS).toBe('Microsoft.VSTS.Scheduling.StoryPoints');
    });
  });
});
