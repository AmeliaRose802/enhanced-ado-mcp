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
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JSONSchemaProperty;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
  $ref?: string;
  oneOf?: JSONSchemaProperty[];
  anyOf?: JSONSchemaProperty[];
  allOf?: JSONSchemaProperty[];
  [key: string]: unknown; // Allow additional JSON Schema keywords
}

export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JSONSchemaProperty;
  items?: JSONSchemaProperty;
  description?: string;
  title?: string;
  $schema?: string;
  definitions?: Record<string, JSONSchemaProperty>;
  oneOf?: JSONSchemaProperty[];
  anyOf?: JSONSchemaProperty[];
  allOf?: JSONSchemaProperty[];
  [key: string]: unknown; // Allow additional JSON Schema keywords
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

// Export all types from submodules - organized by domain

// Core MCP Protocol Types
export * from './mcp.js';

// Azure DevOps API Types
export * from './ado.js';

// Work Item Types and Operations
export * from './work-items.js';

// AI-Powered Analysis Types
export * from './analysis.js';

// Query and Analytics Types
export * from './queries.js';

// Error Handling Types
export * from './error-categories.js';