import { spawn } from "child_process";
import path from "path";
import os from "os";
import type { ExecResult, ToolExecutionResult } from "../types/index.js";
import { scriptsDir, repoRoot } from "./paths.js";

/**
 * Execute a PowerShell script with the given arguments
 */
export function runPwshScript(scriptName: string, args: Record<string, unknown>): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(scriptsDir, scriptName);

    const pwsh = process.env.PWSH_PATH || (os.platform() === "win32" ? "pwsh" : "pwsh");

    // Build PowerShell argument list: -File <script> -ParamName ParamValue ...
    const psArgs: string[] = ["-NoLogo", "-NoProfile", "-File", scriptPath];

    for (const [key, value] of Object.entries(args)) {
      if (value === undefined || value === null || value === "") continue; // skip empty optional params
      // Switch parameters (boolean true) -> -SwitchName
      if (typeof value === "boolean") {
        if (value) {
          psArgs.push(`-${key}`);
        }
      } else {
        psArgs.push(`-${key}`);
        psArgs.push(String(value));
      }
    }

    const child = spawn(pwsh, psArgs, { cwd: repoRoot, env: process.env });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    child.on("close", (code: number | null) => {
      resolve({ stdout, stderr, exitCode: code });
    });
    child.on("error", (err: Error) => reject(err));
  });
}

/**
 * Execute a script and parse the result
 */
export async function executeScript(toolName: string, script: string, input: any): Promise<ToolExecutionResult> {
  const result = await runPwshScript(script, input);
  let parsed: any = null;
  let success = result.exitCode === 0;

  // The scripts print JSON to stdout; try parse last JSON object
  const trimmed = result.stdout.trim();
  try {
    // Attempt to find last JSON block if extra logs are present
    const jsonMatch = trimmed.match(/\{[\s\S]*$/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
      // trust script's success field if available
      if (typeof parsed.success === "boolean") {
        success = parsed.success;
      }
    }
  } catch (e) {
    // ignore parse error; we'll return raw output
  }

  return {
    success,
    data: parsed?.data ?? parsed ?? undefined,
    raw: {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    },
    metadata: parsed?.metadata ?? {},
    errors: parsed?.errors ?? (success ? [] : [result.stderr || "Script failed"]),
    warnings: parsed?.warnings ?? []
  };
}