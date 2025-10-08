/**
 * MCP (Model Context Protocol) Type Definitions
 * Provides type safety for MCP server interactions
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Request, Notification, Result } from "@modelcontextprotocol/sdk/types.js";

/**
 * MCP Server instance type from the SDK
 * Uses default generic types from the SDK for maximum compatibility
 * Request, Notification, and Result are the base types from the SDK
 */
export type MCPServer = Server<Request, Notification, Result>;

/**
 * MCPServer-like object for testing purposes
 * Defines minimal interface required for sampling operations
 */
export interface MCPServerLike {
  createMessage?: (params: unknown) => Promise<unknown>;
  getClientCapabilities?: () => { sampling?: unknown } | undefined;
  // Allow additional properties for test mocks
  [key: string]: unknown;
}

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
