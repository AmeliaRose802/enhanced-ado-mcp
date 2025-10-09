import { join, resolve } from "path";
import { cwd } from "process";

// Import module directory from .mjs file that can use import.meta.url directly
// The .mjs extension ensures it's always treated as ES module with import.meta support
// @ts-ignore - .mjs file exists but TypeScript can't validate it
import { moduleDir } from './module-dir.mjs';

let thisFileDir: string;

// In test/Jest environment - use cwd-based path
if (process.env.JEST_WORKER_ID !== undefined) {
  thisFileDir = join(cwd(), 'src', 'utils');
} else {
  // In production - use the directory from module-dir.mjs which has import.meta.url
  thisFileDir = moduleDir;
  
  if (process.env.MCP_DEBUG === '1') {
    console.error(`[paths.ts] Resolved via module-dir.mjs: ${thisFileDir}`);
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