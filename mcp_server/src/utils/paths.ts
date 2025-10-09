import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { cwd } from "process";

/**
 * Get the directory containing this file at runtime
 * CRITICAL: This must resolve to the actual file location, NOT process.cwd()
 * because the MCP server can be launched from any directory
 */
function getThisFileDirectory(): string {
  // In test/Jest environment
  if (process.env.JEST_WORKER_ID !== undefined) {
    return join(cwd(), 'src', 'utils');
  }
  
  // In ES module production - import.meta.url is available
  // We need to check if we're in an ES module context safely
  try {
    // Use eval to avoid Jest parse-time errors with import.meta
    // This is only executed at runtime when not in Jest
    const hasImportMeta = eval('typeof import.meta !== "undefined" && import.meta.url');
    if (hasImportMeta) {
      const importMetaUrl = eval('import.meta.url');
      const fileDir = dirname(fileURLToPath(importMetaUrl));
      if (process.env.MCP_DEBUG === '1') {
        console.error(`[paths.ts] Resolved via import.meta.url: ${fileDir}`);
      }
      return fileDir;
    }
  } catch (e) {
    // import.meta not available or eval failed
    if (process.env.MCP_DEBUG === '1') {
      console.error('[paths.ts] import.meta not available:', e);
    }
  }
  
  // Fallback - this should only happen in non-ES-module contexts
  if (process.env.MCP_DEBUG === '1') {
    console.error('[paths.ts] WARNING: Using cwd() fallback');
  }
  return join(cwd(), 'src', 'utils');
}

// Calculate paths relative to THIS file's location
// Structure: dist/utils/paths.js -> ../../ = mcp_server root
//        OR: src/utils/paths.ts -> ../../ = mcp_server root
const thisFileDir = getThisFileDirectory();
export const repoRoot = resolve(thisFileDir, "..", "..");
export const promptsDir = join(repoRoot, "prompts");

// Debug logging
if (process.env.MCP_DEBUG === '1') {
  console.error(`[paths.ts] thisFileDir: ${thisFileDir}`);
  console.error(`[paths.ts] repoRoot: ${repoRoot}`);
  console.error(`[paths.ts] promptsDir: ${promptsDir}`);
}