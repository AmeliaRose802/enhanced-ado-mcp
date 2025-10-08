/**
 * Tests for error categorization system
 * Validates error categories, codes, and metadata handling
 */

import {
  ErrorCategory,
  ErrorCode,
  createErrorMetadata,
  categorizeError,
  type ErrorMetadata,
} from "../types/error-categories.js";
import {
  buildErrorResponse,
  buildValidationErrorResponse,
  buildAzureCliErrorResponse,
  buildAuthenticationError,
  buildNetworkError,
  buildNotFoundError,
  buildBusinessLogicError,
  buildRateLimitError,
  buildPermissionError,
} from "../utils/response-builder.js";

describe("Error Categorization System", () => {
  describe("ErrorCategory enum", () => {
    it("should define all required categories", () => {
      expect(ErrorCategory.VALIDATION).toBe("validation");
      expect(ErrorCategory.AUTHENTICATION).toBe("authentication");
      expect(ErrorCategory.NETWORK).toBe("network");
      expect(ErrorCategory.BUSINESS_LOGIC).toBe("business-logic");
      expect(ErrorCategory.NOT_FOUND).toBe("not-found");
      expect(ErrorCategory.RATE_LIMIT).toBe("rate-limit");
      expect(ErrorCategory.PERMISSION_DENIED).toBe("permission-denied");
      expect(ErrorCategory.UNKNOWN).toBe("unknown");
    });
  });

  describe("ErrorCode constants", () => {
    it("should define validation error codes", () => {
      expect(ErrorCode.VALIDATION_SCHEMA).toBe("ERR_VALIDATION_001");
      expect(ErrorCode.VALIDATION_REQUIRED_FIELD).toBe("ERR_VALIDATION_002");
      expect(ErrorCode.VALIDATION_INVALID_FORMAT).toBe("ERR_VALIDATION_003");
    });

    it("should define authentication error codes", () => {
      expect(ErrorCode.AUTH_NOT_LOGGED_IN).toBe("ERR_AUTH_100");
      expect(ErrorCode.AUTH_INVALID_TOKEN).toBe("ERR_AUTH_101");
      expect(ErrorCode.AUTH_CLI_NOT_AVAILABLE).toBe("ERR_AUTH_103");
    });

    it("should define network error codes", () => {
      expect(ErrorCode.NETWORK_TIMEOUT).toBe("ERR_NETWORK_200");
      expect(ErrorCode.NETWORK_CONNECTION_FAILED).toBe("ERR_NETWORK_201");
    });

    it("should define not found error codes", () => {
      expect(ErrorCode.NOT_FOUND_WORK_ITEM).toBe("ERR_NOT_FOUND_400");
      expect(ErrorCode.NOT_FOUND_PROJECT).toBe("ERR_NOT_FOUND_401");
      expect(ErrorCode.NOT_FOUND_QUERY_HANDLE).toBe("ERR_NOT_FOUND_403");
    });

    it("should define rate limit error codes", () => {
      expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe("ERR_RATE_LIMIT_500");
    });

    it("should define permission error codes", () => {
      expect(ErrorCode.PERMISSION_DENIED).toBe("ERR_PERMISSION_600");
    });
  });

  describe("createErrorMetadata", () => {
    it("should create basic error metadata", () => {
      const metadata = createErrorMetadata(ErrorCategory.VALIDATION);

      expect(metadata.category).toBe(ErrorCategory.VALIDATION);
      expect(metadata.timestamp).toBeDefined();
      expect(metadata.retryable).toBe(false);
    });

    it("should include error code when provided", () => {
      const metadata = createErrorMetadata(ErrorCategory.VALIDATION, ErrorCode.VALIDATION_SCHEMA);

      expect(metadata.code).toBe(ErrorCode.VALIDATION_SCHEMA);
    });

    it("should include context when provided", () => {
      const context = { fieldName: "title", received: "" };
      const metadata = createErrorMetadata(
        ErrorCategory.VALIDATION,
        ErrorCode.VALIDATION_REQUIRED_FIELD,
        context
      );

      expect(metadata.context).toEqual(context);
    });

    it("should mark network errors as retryable", () => {
      const metadata = createErrorMetadata(ErrorCategory.NETWORK);
      expect(metadata.retryable).toBe(true);
    });

    it("should mark rate limit errors as retryable", () => {
      const metadata = createErrorMetadata(ErrorCategory.RATE_LIMIT);
      expect(metadata.retryable).toBe(true);
    });

    it("should mark validation errors as non-retryable", () => {
      const metadata = createErrorMetadata(ErrorCategory.VALIDATION);
      expect(metadata.retryable).toBe(false);
    });
  });

  describe("categorizeError", () => {
    it("should categorize authentication errors", () => {
      expect(categorizeError("User not logged in")).toBe(ErrorCategory.AUTHENTICATION);
      expect(categorizeError("Authentication failed")).toBe(ErrorCategory.AUTHENTICATION);
      expect(categorizeError("Unauthorized access")).toBe(ErrorCategory.AUTHENTICATION);
      expect(categorizeError("Please run az login")).toBe(ErrorCategory.AUTHENTICATION);
    });

    it("should categorize not found errors", () => {
      expect(categorizeError("Work item not found")).toBe(ErrorCategory.NOT_FOUND);
      expect(categorizeError("Project does not exist")).toBe(ErrorCategory.NOT_FOUND);
    });

    it("should categorize permission errors", () => {
      expect(categorizeError("Permission denied")).toBe(ErrorCategory.PERMISSION_DENIED);
      expect(categorizeError("Access denied")).toBe(ErrorCategory.PERMISSION_DENIED);
      expect(categorizeError("Forbidden")).toBe(ErrorCategory.PERMISSION_DENIED);
      expect(categorizeError("Insufficient permissions")).toBe(ErrorCategory.PERMISSION_DENIED);
    });

    it("should categorize network errors", () => {
      expect(categorizeError("Connection timeout")).toBe(ErrorCategory.NETWORK);
      expect(categorizeError("Network error")).toBe(ErrorCategory.NETWORK);
      expect(categorizeError("ECONNREFUSED")).toBe(ErrorCategory.NETWORK);
      expect(categorizeError("ENOTFOUND")).toBe(ErrorCategory.NETWORK);
    });

    it("should categorize rate limit errors", () => {
      expect(categorizeError("Rate limit exceeded")).toBe(ErrorCategory.RATE_LIMIT);
      expect(categorizeError("API throttled")).toBe(ErrorCategory.RATE_LIMIT);
      expect(categorizeError("Quota exceeded")).toBe(ErrorCategory.RATE_LIMIT);
    });

    it("should categorize validation errors", () => {
      expect(categorizeError("Validation failed")).toBe(ErrorCategory.VALIDATION);
      expect(categorizeError("Invalid parameter")).toBe(ErrorCategory.VALIDATION);
      expect(categorizeError("Field is required")).toBe(ErrorCategory.VALIDATION);
      expect(categorizeError("Value must be positive")).toBe(ErrorCategory.VALIDATION);
    });

    it("should default to unknown for uncategorized errors", () => {
      expect(categorizeError("Something went wrong")).toBe(ErrorCategory.UNKNOWN);
      expect(categorizeError("Unexpected error occurred")).toBe(ErrorCategory.UNKNOWN);
    });

    it("should handle Error objects", () => {
      const error = new Error("not logged in");
      expect(categorizeError(error)).toBe(ErrorCategory.AUTHENTICATION);
    });
  });

  describe("buildErrorResponse with categorization", () => {
    it("should include error category in metadata", () => {
      const result = buildErrorResponse("Test error", {}, ErrorCategory.VALIDATION);

      expect(result.success).toBe(false);
      expect(result.metadata.errorCategory).toBe(ErrorCategory.VALIDATION);
      expect(result.metadata.errorMetadata).toBeDefined();
      expect(result.metadata.errorMetadata.category).toBe(ErrorCategory.VALIDATION);
    });

    it("should include error code in metadata when provided", () => {
      const result = buildErrorResponse(
        "Test error",
        {},
        ErrorCategory.VALIDATION,
        ErrorCode.VALIDATION_SCHEMA
      );

      expect(result.metadata.errorCode).toBe(ErrorCode.VALIDATION_SCHEMA);
      expect(result.metadata.errorMetadata.code).toBe(ErrorCode.VALIDATION_SCHEMA);
    });

    it("should auto-categorize when category not provided", () => {
      const result = buildErrorResponse("Work item not found");

      expect(result.metadata.errorCategory).toBe(ErrorCategory.NOT_FOUND);
    });

    it("should maintain backwards compatibility with existing metadata", () => {
      const result = buildErrorResponse("Test error", { source: "test", customField: "value" });

      expect(result.metadata.source).toBe("test");
      expect(result.metadata.customField).toBe("value");
      expect(result.metadata.samplingAvailable).toBe(true);
    });

    it("should preserve error message in errors array", () => {
      const result = buildErrorResponse("Test error message");

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe("Test error message");
    });
  });

  describe("buildValidationErrorResponse with categorization", () => {
    it("should categorize as validation error", () => {
      const zodError = {
        issues: [{ path: ["title"], message: "Required", received: undefined }],
      };

      const result = buildValidationErrorResponse(zodError);

      expect(result.metadata.errorCategory).toBe(ErrorCategory.VALIDATION);
      expect(result.metadata.errorCode).toBe(ErrorCode.VALIDATION_SCHEMA);
    });

    it("should maintain validation error formatting", () => {
      const zodError = {
        issues: [{ path: ["title"], message: "Required" }],
      };

      const result = buildValidationErrorResponse(zodError);

      expect(result.errors[0]).toContain("Validation error");
      expect(result.errors[0]).toContain("title:");
      expect(result.errors[0]).toContain("Required");
      expect(result.errors[0]).toContain("💡 Tip");
    });
  });

  describe("buildAzureCliErrorResponse with categorization", () => {
    it("should categorize CLI not available as business logic error", () => {
      const error = {
        isAvailable: false,
        isLoggedIn: false,
        error: "Azure CLI not found",
      };

      const result = buildAzureCliErrorResponse(error);

      expect(result.metadata.errorCategory).toBe(ErrorCategory.BUSINESS_LOGIC);
      expect(result.metadata.errorCode).toBe(ErrorCode.AUTH_CLI_NOT_AVAILABLE);
    });

    it("should categorize not logged in as authentication error", () => {
      const error = {
        isAvailable: true,
        isLoggedIn: false,
        error: "Not logged in to Azure CLI",
      };

      const result = buildAzureCliErrorResponse(error);

      expect(result.metadata.errorCategory).toBe(ErrorCategory.AUTHENTICATION);
      expect(result.metadata.errorCode).toBe(ErrorCode.AUTH_NOT_LOGGED_IN);
    });
  });

  describe("Helper functions", () => {
    describe("buildAuthenticationError", () => {
      it("should create authentication error response", () => {
        const result = buildAuthenticationError("User not authenticated");

        expect(result.success).toBe(false);
        expect(result.metadata.errorCategory).toBe(ErrorCategory.AUTHENTICATION);
        expect(result.errors[0]).toBe("User not authenticated");
      });
    });

    describe("buildNetworkError", () => {
      it("should create network error response", () => {
        const result = buildNetworkError("Connection failed");

        expect(result.success).toBe(false);
        expect(result.metadata.errorCategory).toBe(ErrorCategory.NETWORK);
        expect(result.metadata.errorCode).toBe(ErrorCode.NETWORK_CONNECTION_FAILED);
        expect(result.metadata.errorMetadata.retryable).toBe(true);
      });
    });

    describe("buildNotFoundError", () => {
      it("should create not found error for work item", () => {
        const result = buildNotFoundError("work-item", 12345);

        expect(result.success).toBe(false);
        expect(result.metadata.errorCategory).toBe(ErrorCategory.NOT_FOUND);
        expect(result.metadata.errorCode).toBe(ErrorCode.NOT_FOUND_WORK_ITEM);
        expect(result.errors[0]).toContain("12345");
        expect(result.metadata.resourceType).toBe("work-item");
        expect(result.metadata.resourceId).toBe(12345);
      });

      it("should create not found error for project", () => {
        const result = buildNotFoundError("project", "MyProject");

        expect(result.metadata.errorCode).toBe(ErrorCode.NOT_FOUND_PROJECT);
        expect(result.errors[0]).toContain("MyProject");
      });

      it("should create not found error for query handle", () => {
        const result = buildNotFoundError("query-handle", "qh_abc123");

        expect(result.metadata.errorCode).toBe(ErrorCode.NOT_FOUND_QUERY_HANDLE);
        expect(result.errors[0]).toContain("qh_abc123");
      });

      it("should use generic not found code for unknown resource types", () => {
        const result = buildNotFoundError("custom-resource", "res123");

        expect(result.metadata.errorCode).toBe(ErrorCode.NOT_FOUND_RESOURCE);
      });
    });

    describe("buildBusinessLogicError", () => {
      it("should create business logic error response", () => {
        const result = buildBusinessLogicError("Invalid state transition");

        expect(result.success).toBe(false);
        expect(result.metadata.errorCategory).toBe(ErrorCategory.BUSINESS_LOGIC);
        expect(result.metadata.errorCode).toBe(ErrorCode.BUSINESS_OPERATION_FAILED);
      });
    });

    describe("buildRateLimitError", () => {
      it("should create rate limit error with default message", () => {
        const result = buildRateLimitError();

        expect(result.success).toBe(false);
        expect(result.metadata.errorCategory).toBe(ErrorCategory.RATE_LIMIT);
        expect(result.metadata.errorCode).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
        expect(result.errors[0]).toContain("Rate limit exceeded");
        expect(result.metadata.errorMetadata.retryable).toBe(true);
      });

      it("should create rate limit error with custom message", () => {
        const result = buildRateLimitError("API quota exceeded, retry after 60 seconds");

        expect(result.errors[0]).toBe("API quota exceeded, retry after 60 seconds");
      });
    });

    describe("buildPermissionError", () => {
      it("should create permission error response", () => {
        const result = buildPermissionError("Insufficient permissions to modify work item");

        expect(result.success).toBe(false);
        expect(result.metadata.errorCategory).toBe(ErrorCategory.PERMISSION_DENIED);
        expect(result.metadata.errorCode).toBe(ErrorCode.PERMISSION_DENIED);
      });
    });
  });

  describe("Backwards compatibility", () => {
    it("should work with existing code that does not provide category", () => {
      const result = buildErrorResponse("Some error", { source: "legacy" });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toBe("Some error");
      expect(result.metadata.source).toBe("legacy");
      expect(result.metadata.errorCategory).toBeDefined();
      expect(result.metadata.errorMetadata).toBeDefined();
    });

    it("should preserve existing metadata fields", () => {
      const result = buildErrorResponse("Error", {
        tool: "test-tool",
        timestamp: "2025-01-01",
        customField: 123,
      });

      expect(result.metadata.tool).toBe("test-tool");
      expect(result.metadata.timestamp).toBe("2025-01-01");
      expect(result.metadata.customField).toBe(123);
    });
  });

  describe("Integration with ToolExecutionResult", () => {
    it("should create valid ToolExecutionResult structure", () => {
      const result = buildNotFoundError("work-item", 99999);

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("metadata");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(typeof result.metadata).toBe("object");
    });

    it("should maintain consistency across different error types", () => {
      const errors = [
        buildAuthenticationError("Auth error"),
        buildNetworkError("Network error"),
        buildNotFoundError("work-item", 123),
        buildBusinessLogicError("Logic error"),
        buildRateLimitError(),
        buildPermissionError("Permission error"),
      ];

      errors.forEach((error) => {
        expect(error.success).toBe(false);
        expect(error.metadata.errorCategory).toBeDefined();
        expect(error.metadata.errorMetadata).toBeDefined();
        expect(error.metadata.errorMetadata.category).toBeDefined();
        expect(error.metadata.errorMetadata.timestamp).toBeDefined();
        expect(typeof error.metadata.errorMetadata.retryable).toBe("boolean");
      });
    });
  });
});
