/**
 * Azure DevOps Discovery Service
 *
 * Provides utility functions for Azure DevOps integration
 */

import { execSync } from "child_process";

/**
 * Check if Azure CLI is available and user is logged in
 */
export function validateAzureCLI(): { isAvailable: boolean; isLoggedIn: boolean; error?: string } {
  try {
    // Check if az command is available
    execSync("az --version", { stdio: "pipe" });

    // Check if user is logged in
    try {
      execSync("az account show", { stdio: "pipe" });
      return { isAvailable: true, isLoggedIn: true };
    } catch {
      return {
        isAvailable: true,
        isLoggedIn: false,
        error: "Azure CLI is available but user is not logged in. Please run: az login",
      };
    }
  } catch (error) {
    return {
      isAvailable: false,
      isLoggedIn: false,
      error: "Azure CLI is not installed or not available in PATH",
    };
  }
}
