import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base path to repo root (mcp_server folder sibling of ado_scripts)
// Assuming structure: <repo>/mcp_server/src/index.ts
export const repoRoot = path.resolve(__dirname, "..", "..", "..");
export const scriptsDir = path.join(repoRoot, "ado_scripts");
export const promptsDir = path.join(repoRoot, "prompts");