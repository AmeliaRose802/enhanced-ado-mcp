/**
 * MCP (Model Context Protocol) Type Definitions
 * Provides type safety for MCP server interactions
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Request, Notification, Result } from "@modelcontextprotocol/sdk/types.js";
import type { JSONValue } from './index.js';

/**
 * MCP Server instance type from the SDK
 * Uses default generic types from the SDK for maximum compatibility
 * Request, Notification, and Result are the base types from the SDK
 */
export type MCPServer = Server<Request, Notification, Result>;

/**
 * Sampling message parameters
 * Used when requesting AI sampling from the MCP server
 */
export interface SamplingMessageParams {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  [key: string]: JSONValue | undefined;
}

/**
 * Sampling message result
 * Response from AI sampling operations
 */
export interface SamplingMessageResult {
  model?: string;
  role: 'assistant';
  content: string;
  stopReason?: string;
  [key: string]: JSONValue | undefined;
}

/**
 * Client sampling capabilities
 * Indicates what sampling features the client supports
 */
export interface SamplingCapabilities {
  /** Whether the client supports basic sampling */
  supported?: boolean;
  /** Maximum tokens the client can handle */
  maxTokens?: number;
  /** Available models for sampling */
  models?: string[];
  [key: string]: JSONValue | undefined;
}

/**
 * MCPServer-like object for testing purposes
 * Defines minimal interface required for sampling operations
 */
export interface MCPServerLike {
  createMessage?: (params: SamplingMessageParams) => Promise<SamplingMessageResult>;
  getClientCapabilities?: () => { sampling?: SamplingCapabilities } | undefined;
  /** 
   * Allow additional properties for test mocks
   * Test mocks may include functions and complex types that cannot be constrained
   * Use unknown for maximum type safety - consumers should validate the structure
   */
  [key: string]: unknown;
}

/**
 * MCP Transport
 * Transport layer for MCP communication (stdio, SSE, etc.)
 */
export interface MCPTransport {
  /** Start the transport connection */
  start?: () => Promise<void>;
  /** Close the transport connection */
  close?: () => Promise<void>;
}

/**
 * MCP Request
 * Standard MCP request structure following JSON-RPC 2.0
 */
export interface MCPRequest {
  /** Method name being invoked */
  method: string;
  /** Parameters for the method call */
  params?: Record<string, JSONValue>;
  /** Unique request identifier */
  id?: string | number;
}

/**
 * MCP Response
 * Standard MCP response structure following JSON-RPC 2.0
 */
export interface MCPResponse {
  /** Result data if successful */
  result?: JSONValue;
  /** Error information if failed */
  error?: MCPError;
  /** Request identifier this response corresponds to */
  id?: string | number;
}

/**
 * MCP Error
 * Standard error structure for MCP operations
 */
export interface MCPError {
  /** Error code (follows JSON-RPC error codes) */
  code: number;
  /** Human-readable error message */
  message: string;
  /** Additional error context data */
  data?: JSONValue;
}

/**
 * MCP Tool Call Parameters
 * Parameters passed to tool invocations - can be any JSON-serializable values
 */
export interface MCPToolParams {
  [key: string]: JSONValue | undefined;
}

/**
 * MCP Tool Result Content Item
 * Individual content item in a tool result (text, image, or resource reference)
 */
export interface MCPToolResultContent {
  /** Type of content */
  type: 'text' | 'image' | 'resource';
  /** Text content (for type='text') */
  text?: string;
  /** Base64-encoded data (for type='image') */
  data?: string;
  /** MIME type (for type='image') */
  mimeType?: string;
}

/**
 * MCP Tool Result
 * Standard result structure returned by MCP tools
 */
export interface MCPToolResult {
  /** Content items in the result */
  content: MCPToolResultContent[];
  /** Whether this result represents an error */
  isError?: boolean;
}
