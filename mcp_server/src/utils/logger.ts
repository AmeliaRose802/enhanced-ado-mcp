/**
 * Logger utility for proper log levels in MCP server
 */
export class Logger {
  private mcpConnected = false;
  
  // Mark when MCP transport is connected - after this, avoid stderr logging
  markMCPConnected() {
    this.mcpConnected = true;
  }

  debug(message: string, ...args: unknown[]) {
    // Only log debug messages if debug mode is enabled and MCP not connected
    if (process.env.MCP_DEBUG === "1" && !this.mcpConnected) {
      console.error(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]) {
    // Info messages to stderr for MCP protocol, but only before connection
    if (!this.mcpConnected) {
      console.error(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]) {
    // Suppress warnings after MCP connection to avoid stderr pollution
    if (!this.mcpConnected) {
      console.error(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]) {
    // Suppress errors after MCP connection to avoid stderr pollution
    // Critical errors should be handled through MCP error responses instead
    if (!this.mcpConnected) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();