import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base paths - prompts and ado_scripts are now in mcp_server directory
// Structure: mcp_server/dist/utils/paths.js -> ../../prompts and ../../ado_scripts
export const repoRoot = path.resolve(__dirname, "..", "..");
export const scriptsDir = path.join(repoRoot, "ado_scripts");
export const promptsDir = path.join(repoRoot, "prompts");