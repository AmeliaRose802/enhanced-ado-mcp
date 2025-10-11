import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { cwd } from "process";

// Calculate thisFileDir based on environment
let thisFileDir: string;

if (process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test') {
  // Test environment - use simple cwd-based calculation
  thisFileDir = join(cwd(), 'src', 'utils');
} else {
  // Production/development - use import.meta.url to get actual file location
  // This works correctly regardless of where the process is started from
  try {
    // ES Module equivalent of __dirname
    // @ts-ignore - import.meta.url is available at runtime in ES modules
    thisFileDir = dirname(fileURLToPath(import.meta.url));
    
    if (process.env.MCP_DEBUG === '1') {
      console.error(`[paths.ts] Using import.meta.url-based path resolution: ${thisFileDir}`);
    }
  } catch (error) {
    // Fallback to dist location if import.meta.url fails
    thisFileDir = join(cwd(), 'dist', 'utils');
    
    if (process.env.MCP_DEBUG === '1') {
      console.error(`[paths.ts] Fallback to cwd-based path resolution: ${thisFileDir}`);
      console.error(`[paths.ts] Error using import.meta.url:`, error);
    }
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