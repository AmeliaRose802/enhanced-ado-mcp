/**
 * Azure DevOps Token Utility
 * 
 * Centralized token management for Azure DevOps API access
 */

import { execSync } from 'child_process';
import { AZURE_DEVOPS_RESOURCE_ID } from '../config/config.js';

/**
 * Get Azure DevOps access token using Azure CLI
 * @throws Error if Azure CLI is not installed or user is not logged in
 */
export function getAzureDevOpsToken(): string {
  try {
    const result = execSync(
      `az account get-access-token --resource ${AZURE_DEVOPS_RESOURCE_ID} --query accessToken -o tsv`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result.trim();
  } catch (err) {
    throw new Error('Failed to get Azure DevOps token. Ensure you are logged in with az login');
  }
}

/**
 * Execute a curl command against Azure DevOps API
 * @param url The API URL to call
 * @param token The authentication token
 * @returns Parsed JSON response
 * @throws Error if the request fails or returns non-2xx status
 */
export function curlJson(url: string, token: string): any {
  const cmd = `curl -s -S -w "\\n%{http_code}" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" "${url}"`;
  
  try {
    const raw = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    
    // Split response body and status code
    const lastNewlineIndex = raw.lastIndexOf('\n');
    const body = raw.substring(0, lastNewlineIndex);
    const statusCode = raw.substring(lastNewlineIndex + 1).trim();
    
    // Parse response body
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch {
      throw new Error(`Invalid JSON response from Azure DevOps. Status: ${statusCode}, Body: ${body.substring(0, 200)}`);
    }
    
    // Check for HTTP errors
    const statusNum = parseInt(statusCode, 10);
    if (statusNum >= 400) {
      const errorMessage = parsedBody?.message || parsedBody?.value || JSON.stringify(parsedBody);
      throw new Error(`Azure DevOps API error (${statusCode}): ${errorMessage}`);
    }
    
    return parsedBody;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Azure DevOps')) {
      throw error;
    }
    throw new Error(`Failed to execute Azure DevOps API request: ${error instanceof Error ? error.message : String(error)}`);
  }
}
