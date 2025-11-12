import { join, resolve } from "path";
import { cwd } from "process";

// Calculate paths based on environment
let thisFileDir: string;
let internalPromptsDir: string;
let internalRepoRoot: string;

if (process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test') {
  // Test environment - use simple cwd-based calculation  
  thisFileDir = join(cwd(), 'src', 'utils');
  internalRepoRoot = resolve(thisFileDir, "..", "..");
  internalPromptsDir = join(internalRepoRoot, "prompts");
} else {
  // Production/development - initialize with empty values, will be set async
  thisFileDir = '';
  internalPromptsDir = '';
  internalRepoRoot = '';
}

// Export initialization promise for production
export const pathsReady = (process.env.JEST_WORKER_ID === undefined && process.env.NODE_ENV !== 'test')
  ? (async () => {
    try {
      // Dynamic import of .mjs file with proper typing
      const moduleDirModule = await import('./module-dir.mjs');
      thisFileDir = moduleDirModule.moduleDir;
      
      // dist/utils -> dist -> mcp_server (repo root)
      internalRepoRoot = resolve(thisFileDir, "..", "..");
      
      // Prompts are in dist/prompts (dist/utils -> dist)
      const distDir = resolve(thisFileDir, "..");
      internalPromptsDir = join(distDir, "prompts");
      
      if (process.env.MCP_DEBUG === '1') {
        console.error(`[paths.ts] thisFileDir: ${thisFileDir}`);
        console.error(`[paths.ts] repoRoot: ${internalRepoRoot}`);
        console.error(`[paths.ts] promptsDir: ${internalPromptsDir}`);
      }
    } catch (error) {
      console.error(`[paths.ts] Failed to initialize paths:`, error);
      throw error;
    }
  })()
  : Promise.resolve();

// Export path getters
export function getPromptsDir(): string {
  return internalPromptsDir;
}

export function getRepoRoot(): string {
  return internalRepoRoot;
}