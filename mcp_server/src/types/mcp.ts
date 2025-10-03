/**
 * MCP (Model Context Protocol) Type Definitions
 * Provides type safety for MCP server interactions
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

/**
 * MCP Server instance type from the SDK
 * Using 'any' for generics is intentional - the SDK Server has complex generic types
 */
export type MCPServer = Server<any, any>;

/**
 * MCP Transport
 */
export interface MCPTransport {
  // Define based on actual MCP transport interface
  start?: () => Promise<void>;
  close?: () => Promise<void>;
}

/**
 * MCP Request
 */
export interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
  id?: string | number;
}

/**
 * MCP Response
 */
export interface MCPResponse {
  result?: unknown;
  error?: MCPError;
  id?: string | number;
}

/**
 * MCP Error
 */
export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP Tool Call Parameters
 */
export interface MCPToolParams {
  [key: string]: unknown;
}

/**
 * MCP Tool Result
 */
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
