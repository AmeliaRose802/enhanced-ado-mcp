import { join, resolve } from "path";
import { cwd } from "process";

// Calculate thisFileDir based on environment
// In test/Jest environment - use cwd-based path to avoid import.meta.url issues
// In production - we'll load from built location
let thisFileDir: string;

if (process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test') {
  // Test environment - use simple cwd-based calculation
  thisFileDir = join(cwd(), 'src', 'utils');
} else {
  // Production/development - calculate from current file location
  // When running from dist: dist/utils/paths.js
  // When running from src: should not reach here in production
  // For now, we'll use a fallback that works in both cases
  thisFileDir = join(cwd(), 'src', 'utils');
  
  if (process.env.MCP_DEBUG === '1') {
    console.error(`[paths.ts] Using cwd-based path resolution: ${thisFileDir}`);
  }
}

// Calculate paths relative to THIS file's location
// Structure: dist/utils/paths.js -> ../../ = mcp_server root (package root)
//        OR: src/utils/paths.ts -> ../../ = mcp_server root (development)
export const repoRoot = resolve(thisFileDir, "..", "..");
export const promptsDir = join(repoRoot, "prompts");

// Debug logging
if (process.env.MCP_DEBUG === '1') {
  console.error(`[paths.ts] thisFileDir: ${thisFileDir}`);
  console.error(`[paths.ts] repoRoot: ${repoRoot}`);
  console.error(`[paths.ts] promptsDir: ${promptsDir}`);
}