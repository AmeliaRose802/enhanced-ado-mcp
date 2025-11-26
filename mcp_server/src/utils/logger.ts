import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Log level type
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Log entry structure for persistent logging
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Logger utility for proper log levels in MCP server
 * 
 * Features:
 * - MCP protocol aware (suppresses stderr after connection)
 * - Structured logging with timestamps
 * - Optional persistent file logging (via MCP_LOG_FILE env var)
 * - Context metadata support
 */
export class Logger {
  private mcpConnected = false;
  private logFilePath?: string;
  
  constructor() {
    // Initialize file logging if MCP_LOG_FILE is set
    const logFile = process.env.MCP_LOG_FILE;
    if (logFile) {
      this.logFilePath = logFile;
      this.initializeLogFile();
    }
  }
  
  /**
   * Initialize log file with header
   */
  private initializeLogFile() {
    if (!this.logFilePath) return;
    
    try {
      // Create directory if it doesn't exist
      const logDir = join(this.logFilePath, '..');
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
      
      // Write header if file doesn't exist
      if (!existsSync(this.logFilePath)) {
        const header = `Enhanced ADO MCP Server Log - Started ${new Date().toISOString()}\n`;
        writeFileSync(this.logFilePath, header, 'utf8');
      }
    } catch (error) {
      // Silently fail if we can't initialize log file
      // Don't use console here to avoid infinite loop
    }
  }
  
  /**
   * Write log entry to file
   */
  private writeToFile(entry: LogEntry) {
    if (!this.logFilePath) return;
    
    try {
      const logLine = `[${entry.timestamp}] [${entry.level}] ${entry.message}${
        entry.context ? ` ${JSON.stringify(entry.context)}` : ''
      }\n`;
      appendFileSync(this.logFilePath, logLine, 'utf8');
    } catch (error) {
      // Silently fail if we can't write to log file
    }
  }
  
  /**
   * Format timestamp for log entries
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }
  
  /**
   * Mark when MCP transport is connected - after this, avoid stderr logging
   */
  markMCPConnected() {
    this.mcpConnected = true;
    this.info('MCP transport connected - stderr logging suppressed');
  }

  /**
   * Log debug message (only when MCP_DEBUG=1)
   * @param message - Log message
   * @param context - Optional context metadata
   */
  debug(message: string, context?: Record<string, unknown>) {
    const timestamp = this.getTimestamp();
    const entry: LogEntry = { timestamp, level: 'DEBUG', message, context };
    
    // Only log debug messages if debug mode is enabled and MCP not connected
    if (process.env.MCP_DEBUG === "1" && !this.mcpConnected) {
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      console.error(`[${timestamp}] [DEBUG] ${message}${contextStr}`);
    }
    
    // Always write to file if configured
    this.writeToFile(entry);
  }

  /**
   * Log info message
   * @param message - Log message
   * @param context - Optional context metadata
   */
  info(message: string, context?: Record<string, unknown>) {
    const timestamp = this.getTimestamp();
    const entry: LogEntry = { timestamp, level: 'INFO', message, context };
    
    // Info messages to stderr for MCP protocol, but only before connection
    if (!this.mcpConnected) {
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      console.error(`[${timestamp}] [INFO] ${message}${contextStr}`);
    }
    
    // Always write to file if configured
    this.writeToFile(entry);
  }

  /**
   * Log warning message
   * @param message - Log message
   * @param context - Optional context metadata
   */
  warn(message: string, context?: Record<string, unknown>) {
    const timestamp = this.getTimestamp();
    const entry: LogEntry = { timestamp, level: 'WARN', message, context };
    
    // Suppress warnings after MCP connection to avoid stderr pollution
    if (!this.mcpConnected) {
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      console.error(`[${timestamp}] [WARN] ${message}${contextStr}`);
    }
    
    // Always write to file if configured
    this.writeToFile(entry);
  }

  /**
   * Log error message
   * @param message - Log message
   * @param context - Optional context metadata (e.g., error stack, request ID)
   */
  error(message: string, context?: Record<string, unknown>) {
    const timestamp = this.getTimestamp();
    const entry: LogEntry = { timestamp, level: 'ERROR', message, context };
    
    // Suppress errors after MCP connection to avoid stderr pollution
    // Critical errors should be handled through MCP error responses instead
    if (!this.mcpConnected) {
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      console.error(`[${timestamp}] [ERROR] ${message}${contextStr}`);
    }
    
    // Always write to file if configured
    this.writeToFile(entry);
  }
  
  /**
   * Get current log file path (if configured)
   */
  getLogFilePath(): string | undefined {
    return this.logFilePath;
  }
}

export const logger = new Logger();

/**
 * Convert unknown error to logger context format
 * @param error - Unknown error from catch block
 * @returns Safe context object for logger
 */
export function errorToContext(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  
  if (typeof error === 'object' && error !== null) {
    return { error };
  }
  
  return { error: String(error) };
}