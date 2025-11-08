/**
 * Azure DevOps Discovery Service
 * 
 * Provides utility functions for Azure DevOps integration
 */

import { execSync } from 'child_process';
import { createADOHttpClient } from '../utils/ado-http-client.js';
import { getTokenProvider } from '../utils/token-provider.js';
import { logger } from '../utils/logger.js';

/**
 * Check if Azure CLI is available and user is logged in
 */
export function validateAzureCLI(): { isAvailable: boolean, isLoggedIn: boolean, error?: string } {
  try {
    // Check if az command is available
    execSync('az --version', { stdio: 'pipe' });
    
    // Check if user is logged in
    try {
      execSync('az account show', { stdio: 'pipe' });
      return { isAvailable: true, isLoggedIn: true };
    } catch {
      return { 
        isAvailable: true, 
        isLoggedIn: false, 
        error: 'Azure CLI is available but user is not logged in. Please run: az login' 
      };
    }
  } catch (error) {
    return { 
      isAvailable: false, 
      isLoggedIn: false, 
      error: 'Azure CLI is not installed or not available in PATH' 
    };
  }
}

/**
 * Team iteration with status
 */
interface TeamIteration {
  id: string;
  name: string;
  path: string;
  attributes: {
    startDate?: string;
    finishDate?: string;
    timeFrame: 'past' | 'current' | 'future';
  };
}

/**
 * Get the current iteration for a team based on area path
 * Returns the iteration path that is currently active (timeFrame === 'current')
 * 
 * @param organization - Azure DevOps organization
 * @param project - Azure DevOps project
 * @param areaPath - Area path to determine team (e.g., "ProjectName\\Team\\Component")
 * @param teamOverride - Optional explicit team name to use instead of extracting from area path
 * @returns Current iteration path or null if not found
 */
export async function getCurrentIterationPath(
  organization: string,
  project: string,
  areaPath: string,
  teamOverride?: string
): Promise<string | null> {
  try {
    // Use explicit team override if provided, otherwise extract from area path
    let teamName: string;
    
    if (teamOverride) {
      teamName = teamOverride;
      logger.debug(`Using explicit team name from configuration: ${teamName}`);
    } else {
      // Extract team name from area path
      // Area path format: "ProjectName\TeamName\OptionalSubArea"
      const segments = areaPath.split('\\').filter(s => s.length > 0);
      if (segments.length < 2) {
        logger.warn(`Area path "${areaPath}" does not contain team information. Cannot determine current iteration.`);
        logger.warn(`Hint: If your area path structure is non-standard, use --team <team-name> to explicitly specify the team.`);
        return null;
      }

      teamName = segments[1]; // Second segment is typically the team name
      logger.debug(`Extracted team name from area path: ${teamName}`);
      logger.debug(`Attempting to get current iteration for team: ${teamName}`);
    }

    const httpClient = createADOHttpClient(organization, getTokenProvider(), project);
    
    // Get team iterations with timeFrame filter
    // API: GET https://dev.azure.com/{organization}/{project}/{team}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.1
    // Use absolute URL since team needs to be inserted before /_apis in the path
    const absoluteUrl = `https://dev.azure.com/${organization}/${project}/${teamName}/_apis/work/teamsettings/iterations?$timeframe=current`;
    
    const response = await httpClient.get<{ value: TeamIteration[] }>(absoluteUrl);
    
    if (response.data.value && response.data.value.length > 0) {
      const currentIteration = response.data.value[0];
      logger.debug(`Found current iteration: ${currentIteration.path}`);
      return currentIteration.path;
    }

    logger.debug(`No current iteration found for team: ${teamName}`);
    return null;
  } catch (error) {
    // Log error but don't fail - iteration path is optional
    logger.warn(`Failed to discover current iteration path: ${error instanceof Error ? error.message : String(error)}`);
    if (!teamOverride) {
      logger.warn(`Hint: If the auto-detected team name is incorrect, use --team <team-name> to explicitly specify the team.`);
      logger.warn(`      For example: enhanced-ado-mcp myorg --area-path "${areaPath}" --team "CorrectTeamName"`);
    }
    return null;
  }
}

/**
 * Get all iterations for a team based on area path
 * Useful for validation and debugging
 * 
 * @param organization - Azure DevOps organization
 * @param project - Azure DevOps project
 * @param areaPath - Area path to determine team
 * @param teamOverride - Optional explicit team name to use instead of extracting from area path
 * @returns Array of team iterations
 */
export async function getTeamIterations(
  organization: string,
  project: string,
  areaPath: string,
  teamOverride?: string
): Promise<TeamIteration[]> {
  try {
    // Use explicit team override if provided, otherwise extract from area path
    let teamName: string;
    
    if (teamOverride) {
      teamName = teamOverride;
    } else {
      const segments = areaPath.split('\\').filter(s => s.length > 0);
      if (segments.length < 2) {
        logger.warn(`Area path "${areaPath}" does not contain team information.`);
        return [];
      }
      teamName = segments[1];
    }

    logger.debug(`Fetching all iterations for team: ${teamName}`);

    const httpClient = createADOHttpClient(organization, getTokenProvider(), project);
    // Use absolute URL since team needs to be inserted before /_apis in the path
    const absoluteUrl = `https://dev.azure.com/${organization}/${project}/${teamName}/_apis/work/teamsettings/iterations`;
    
    const response = await httpClient.get<{ value: TeamIteration[] }>(absoluteUrl);
    return response.data.value || [];
  } catch (error) {
    logger.warn(`Failed to fetch team iterations: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}