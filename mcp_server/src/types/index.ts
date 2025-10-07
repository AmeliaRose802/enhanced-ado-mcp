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

export interface ToolConfig {
  name: string;
  description: string;
  script: string; // underlying PowerShell script file
  schema: z.ZodTypeAny; // zod schema for validation
  inputSchema: any; // JSON schema exposed to MCP clients
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  metadata: Record<string, any>;
  errors: string[];
  warnings: string[];
}

export * from './ado.js';
export * from './mcp.js';
export * from './work-items.js';