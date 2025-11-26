/**
 * Azure DevOps Discovery Service
 * 
 * Provides discovery functions for auto-detecting configuration values
 * such as current iteration path from Azure DevOps team settings.
 */

import { logger } from "../utils/logger.js";
import { getTokenProvider } from "../utils/token-provider.js";
import { cacheService, CacheDataType, CacheService } from "./cache-service.js";

/**
 * Team iteration from Azure DevOps API
 */
interface TeamIteration {
  id: string;
  name: string;
  path: string;
  attributes?: {
    startDate?: string;
    finishDate?: string;
    timeFrame?: string;
  };
}

/**
 * Team iterations response from Azure DevOps API
 */
interface TeamIterationsResponse {
  count: number;
  value: TeamIteration[];
}

/**
 * Get current iteration path for a team
 * 
 * Queries Azure DevOps team settings API to find the active iteration.
 * Team name is extracted from area path (second segment) or provided explicitly.
 * 
 * @param organization - Azure DevOps organization name
 * @param project - Azure DevOps project name
 * @param areaPath - Area path containing team information (format: "Project\Team\...")
 * @param teamOverride - Optional explicit team name (overrides extraction from area path)
 * @returns The discovered iteration path or null if not found
 * 
 * @example
 * ```typescript
 * // Standard area path - team extracted automatically
 * const iteration = await getCurrentIterationPath('myorg', 'MyProject', 'MyProject\\TeamAlpha\\Component');
 * // Result: 'MyProject\\Iteration\\Sprint 42'
 * 
 * // Non-standard area path - explicit team override
 * const iteration = await getCurrentIterationPath('myorg', 'One', 'One\\Custom\\Azure\\Path', 'Krypton');
 * // Result: 'One\\Krypton'
 * ```
 */
export async function getCurrentIterationPath(
  organization: string,
  project: string,
  areaPath: string,
  teamOverride?: string
): Promise<string | null> {
  try {
    // Extract team name from area path or use override
    let teamName: string;
    
    if (teamOverride) {
      teamName = teamOverride;
      logger.debug(`Using explicit team name from configuration: ${teamName}`);
    } else {
      // Extract team name from area path (second segment)
      const segments = areaPath.split('\\').filter(s => s.length > 0);
      
      if (segments.length < 2) {
        logger.warn(`Area path "${areaPath}" does not contain team information. Cannot determine current iteration.`);
        logger.warn('Hint: Use --team <team-name> to explicitly specify the team for iteration discovery.');
        return null;
      }
      
      teamName = segments[1];
      logger.debug(`Extracted team name from area path: ${teamName}`);
    }
    
    // Check cache first
    const cacheKey = CacheService.generateKey('iteration', organization, project, teamName, 'current');
    const cached = cacheService.get<string>(cacheKey);
    if (cached) {
      logger.debug(`[Cache] HIT: Current iteration for team ${teamName}: ${cached}`);
      return cached;
    }
    
    logger.debug(`[Cache] MISS: Fetching current iteration for team: ${teamName}`);
    
    // Query Azure DevOps team settings API for current iteration
    const token = await getTokenProvider()();
    const url = `https://dev.azure.com/${organization}/${project}/${teamName}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.1`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(`Failed to discover current iteration path: HTTP ${response.status} - ${errorText}`);
      
      // Provide helpful hint if team extraction might be wrong
      if (!teamOverride && response.status === 404) {
        logger.warn('Hint: If the auto-detected team name is incorrect, use --team <team-name> to explicitly specify the team.');
      }
      
      return null;
    }
    
    const data: TeamIterationsResponse = await response.json();
    
    if (!data.value || data.value.length === 0) {
      logger.debug(`No current iteration found for team: ${teamName}`);
      return null;
    }
    
    // Return the first iteration with timeframe=current
    const currentIteration = data.value.find(iter => 
      iter.attributes?.timeFrame === 'current'
    ) || data.value[0];
    
    logger.debug(`Found current iteration: ${currentIteration.path}`);
    
    // Cache the result with iterations TTL (30 minutes)
    cacheService.set(cacheKey, currentIteration.path, undefined, CacheDataType.ITERATIONS);
    
    return currentIteration.path;
    
  } catch (error) {
    logger.warn(`Failed to discover current iteration path: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get all iterations for a team (debugging helper)
 * 
 * @param organization - Azure DevOps organization name
 * @param project - Azure DevOps project name
 * @param teamName - Team name
 * @returns Array of team iterations or null if error
 */
export async function getTeamIterations(
  organization: string,
  project: string,
  teamName: string
): Promise<TeamIteration[] | null> {
  try {
    // Check cache first
    const cacheKey = CacheService.generateKey('iterations', organization, project, teamName, 'all');
    const cached = cacheService.get<TeamIteration[]>(cacheKey);
    if (cached) {
      logger.debug(`[Cache] HIT: All iterations for team ${teamName}`);
      return cached;
    }
    
    logger.debug(`[Cache] MISS: Fetching all iterations for team: ${teamName}`);
    
    const token = await getTokenProvider()();
    const url = `https://dev.azure.com/${organization}/${project}/${teamName}/_apis/work/teamsettings/iterations?api-version=7.1`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      logger.warn(`Failed to get team iterations: HTTP ${response.status}`);
      return null;
    }
    
    const data: TeamIterationsResponse = await response.json();
    const iterations = data.value || [];
    
    // Cache with iterations TTL (30 minutes)
    cacheService.set(cacheKey, iterations, undefined, CacheDataType.ITERATIONS);
    
    return iterations;
    
  } catch (error) {
    logger.warn(`Failed to get team iterations: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
