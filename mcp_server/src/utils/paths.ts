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
  
  // In production ESM environment - import.meta.url is available
  return dirname(fileURLToPath(import.meta.url));
}

// Base paths - prompts are in mcp_server directory
// Structure: mcp_server/dist/utils/paths.js -> ../../prompts
const currentDir = getCurrentDir();
export const repoRoot = resolve(currentDir, "..", "..");
export const promptsDir = join(repoRoot, "prompts");