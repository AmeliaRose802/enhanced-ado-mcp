import type { Tool, Prompt } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Re-export types from MCP SDK for convenience
export type { Tool, Prompt };

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface PromptArgument {
  type: string;
  required: boolean;
  description?: string;
  default?: string;
}

export interface ParsedPrompt {
  name: string;
  description: string;
  version: number;
  arguments: Record<string, PromptArgument>;
  content: string;
}

/**
 * JSON Schema types for tool input validation
 * Follows JSON Schema Draft 7 specification
 */
export interface JSONSchemaProperty {
  /** JSON Schema type */
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
  /** Human-readable description */
  description?: string;
  /** Allowed enum values - must be JSON-serializable */
  enum?: JSONValue[];
  /** Default value - must be JSON-serializable */
  default?: JSONValue;
  /** Schema for array items */
  items?: JSONSchemaProperty;
  /** Properties for object types */
  properties?: Record<string, JSONSchemaProperty>;
  /** Required property names for object types */
  required?: string[];
  /** Additional properties setting or schema */
  additionalProperties?: boolean | JSONSchemaProperty;
  /** Minimum string length */
  minLength?: number;
  /** Maximum string length */
  maxLength?: number;
  /** Minimum numeric value */
  minimum?: number;
  /** Maximum numeric value */
  maximum?: number;
  /** Regex pattern for string validation */
  pattern?: string;
  /** Format hint (e.g., 'email', 'uri', 'date-time') */
  format?: string;
  /** Reference to a definition */
  $ref?: string;
  /** One of these schemas must match */
  oneOf?: JSONSchemaProperty[];
  /** Any of these schemas may match */
  anyOf?: JSONSchemaProperty[];
  /** All of these schemas must match */
  allOf?: JSONSchemaProperty[];
  /** 
   * Allow additional JSON Schema keywords
   * Note: This includes complex schema properties that may not be simple JSON values
   */
  [key: string]: 
    | string 
    | number 
    | boolean 
    | null 
    | undefined
    | JSONValue[]
    | JSONSchemaProperty
    | JSONSchemaProperty[]
    | Record<string, JSONSchemaProperty>;
}

/**
 * JSON Schema root definition
 * Represents a complete JSON Schema document
 */
export interface JSONSchema {
  /** Root type of the schema */
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  /** Properties for object schemas */
  properties?: Record<string, JSONSchemaProperty>;
  /** Required property names */
  required?: string[];
  /** Additional properties setting or schema */
  additionalProperties?: boolean | JSONSchemaProperty;
  /** Schema for array items */
  items?: JSONSchemaProperty;
  /** Human-readable description */
  description?: string;
  /** Schema title */
  title?: string;
  /** JSON Schema version identifier */
  $schema?: string;
  /** Reusable schema definitions */
  definitions?: Record<string, JSONSchemaProperty>;
  /** One of these schemas must match */
  oneOf?: JSONSchemaProperty[];
  /** Any of these schemas may match */
  anyOf?: JSONSchemaProperty[];
  /** All of these schemas must match */
  allOf?: JSONSchemaProperty[];
  /** 
   * Allow additional JSON Schema keywords
   * Note: This includes complex schema properties that may not be simple JSON values
   */
  [key: string]: 
    | string 
    | number 
    | boolean 
    | null 
    | undefined
    | string[]
    | JSONSchemaProperty
    | JSONSchemaProperty[]
    | Record<string, JSONSchemaProperty>;
}

export interface ToolConfig {
  name: string;
  description: string;
  script: string; // underlying PowerShell script file
  schema: z.ZodTypeAny; // zod schema for validation
  inputSchema: JSONSchema; // JSON schema exposed to MCP clients
}

/**
 * JSON-serializable primitive values
 */
export type JSONPrimitive = string | number | boolean | null;

/**
 * JSON-serializable value types
 * Represents any valid JSON structure
 */
export type JSONValue = 
  | JSONPrimitive
  | JSONValue[]
  | { [key: string]: JSONValue };

/**
 * Tool execution result data
 * Can be any JSON-serializable value or undefined
 * This replaces 'any' while maintaining flexibility for various data structures
 */
export type ToolExecutionData = JSONValue | undefined;

/**
 * Helper to safely cast values to JSONValue for tool execution data
 * Use this when you have complex types that should be JSON-serializable
 */
export function asToolData(value: unknown): ToolExecutionData {
  return value as ToolExecutionData;
}

/**
 * Metadata for tool execution results
 * Can contain any JSON-serializable values
 */
export type ToolExecutionMetadata = {
  [key: string]: JSONValue | undefined;
} & {
  timestamp?: string;
  duration?: number;
  tool?: string;
  organization?: string;
  project?: string;
};

export interface ToolExecutionResult {
  success: boolean;
  data?: ToolExecutionData;
  metadata: ToolExecutionMetadata;
  errors: string[];
  warnings: string[];
  raw?: {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
  };
}

// Export all types from submodules
export * from './ado.js';
export * from './mcp.js';
export * from './work-items.js';
export * from './error-categories.js';
export * from './analysis.js';
export * from './queries.js';