import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { cwd } from "process";

// Helper to get current directory that works in both test and production
function getCurrentDir(): string {
  // In test/Jest environment, use process.cwd()
  if (process.env.JEST_WORKER_ID !== undefined) {
    // We're in Jest - use cwd and navigate to src/utils
    return join(cwd(), 'src', 'utils');
  }
  
  // In production - use __dirname equivalent with import.meta.url for ES modules
  // Check if we're in an ES module context before accessing import.meta
  try {
    // Use eval to prevent Jest from parsing import.meta at compile time
    const metaUrl = eval('typeof import.meta !== "undefined" ? import.meta.url : null');
    if (metaUrl && typeof metaUrl === 'string') {
      return dirname(fileURLToPath(metaUrl));
    }
  } catch (e) {
    // Fallback if import.meta is not available
  }
  
  // Fallback to cwd-based path
  return join(cwd(), 'src', 'utils');
}

// Base paths - prompts are in mcp_server directory
// Structure: mcp_server/dist/utils/paths.js -> ../../prompts
const currentDir = getCurrentDir();
export const repoRoot = resolve(currentDir, "..", "..");
export const promptsDir = join(repoRoot, "prompts");