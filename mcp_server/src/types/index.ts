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
 * Tool execution result data
 * Uses unknown for maximum flexibility - consumers should validate structure
 * This preserves existing behavior where tools return various data shapes
 */
export type ToolExecutionData = unknown;

/**
 * Metadata for tool execution results
 */
export interface ToolExecutionMetadata extends Record<string, unknown> {
  timestamp?: string;
  duration?: number;
  tool?: string;
  organization?: string;
  project?: string;
}

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