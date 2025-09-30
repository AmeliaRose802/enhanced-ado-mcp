import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Base paths - prompts and ado_scripts are now in mcp_server directory
// Structure: mcp_server/dist/utils/paths.js -> ../../prompts and ../../ado_scripts
const currentDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(currentDir, "..", "..");
export const scriptsDir = join(repoRoot, "ado_scripts");
export const promptsDir = join(repoRoot, "prompts");