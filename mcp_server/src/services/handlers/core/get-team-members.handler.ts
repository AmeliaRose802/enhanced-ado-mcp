/**
 * Handler for get-team-members tool
 * Retrieves a clean list of team member emails using OData Analytics
 */

import type { ToolExecutionResult, ODataAnalyticsArgs } from "@/types/index.js";
import { getRequiredConfig } from "@/config/config.js";
import { logger, errorToContext } from "@/utils/logger.js";
import { asToolData } from "@/types/index.js";
import { getTokenProvider } from '@/utils/token-provider.js';
import { createAuthenticator } from '@/utils/ado-token.js';
import { escapeAreaPath, escapeAreaPathForOData } from "@/utils/work-item-parser.js";

/**
 * Azure CLI token provider specifically for Analytics API
 * The Analytics API requires Azure CLI tokens - OAuth tokens don't work
 */
let analyticsTokenProvider: (() => Promise<string>) | null = null;

function getAnalyticsTokenProvider(): () => Promise<string> {
  if (!analyticsTokenProvider) {
    logger.info('Creating Azure CLI token provider for Analytics API');
    analyticsTokenProvider = createAuthenticator('azcli');
  }
  return analyticsTokenProvider;
}

interface GetTeamMembersArgs {
  areaPath?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  activeOnly?: boolean;
  organization?: string;
  project?: string;
}

/**
 * Get team members by querying OData Analytics for assignees
 * Filters out GitHub Copilot and null values, returns clean email array
 */
export async function handleGetTeamMembers(args: unknown): Promise<ToolExecutionResult> {
  const typedArgs = args as GetTeamMembersArgs;
  try {
    const requiredConfig = getRequiredConfig();
    
    const organization = typedArgs.organization || requiredConfig.organization;
    const project = typedArgs.project || requiredConfig.project;
    const areaPath = typedArgs.areaPath || requiredConfig.defaultAreaPath;
    const activeOnly = typedArgs.activeOnly !== false; // Default true
    
    // Validate required parameters before making API calls
    if (!organization) {
      throw new Error(
        'Organization is required. Either provide it as a parameter or configure it via CLI: ' +
        'enhanced-ado-mcp <organization> --area-path "ProjectName\\AreaName"'
      );
    }
    
    if (!project) {
      throw new Error(
        'Project is required. Either provide it as a parameter or configure it via area path. ' +
        'The project is extracted from the area path (e.g., "MyProject\\Team" → project is "MyProject"). ' +
        'Configure via CLI: enhanced-ado-mcp <organization> --area-path "ProjectName\\AreaName"'
      );
    }
    
    // Calculate date range (default: 90 days ago to today)
    const endDate = typedArgs.dateRangeEnd || new Date().toISOString().split('T')[0];
    const startDate = typedArgs.dateRangeStart || (() => {
      const date = new Date();
      date.setDate(date.getDate() - 90);
      return date.toISOString().split('T')[0];
    })();
    
    logger.info(`Getting team members for ${organization}/${project} (area: ${areaPath || 'all'}, active: ${activeOnly})`);
    
    // Build OData query to get assignees grouped by email
    let odataQuery = "";
    const filterClauses: string[] = [];
    
    // Always exclude null assignees
    filterClauses.push("AssignedTo/UserEmail ne null");
    
    // Add active filter if requested
    if (activeOnly) {
      filterClauses.push(`ChangedDate ge ${startDate}Z`);
      filterClauses.push(`ChangedDate le ${endDate}Z`);
    }
    
    // Add area path filter if provided
    if (areaPath) {
      const escaped = escapeAreaPathForOData(areaPath);
      filterClauses.push(`startswith(Area/AreaPath, '${escaped}')`);
    }
    
    // Build the query
    const filterString = filterClauses.join(' and ');
    odataQuery = `$apply=filter(${filterString})/groupby((AssignedTo/UserEmail,AssignedTo/UserName),aggregate($count as Count))&$orderby=Count desc&$top=1000`;
    
    logger.debug(`OData query: ${odataQuery}`);
    
    // Execute OData query
    const token = await getAnalyticsTokenProvider()();
    const baseUrl = `https://analytics.dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_odata/v3.0-preview/WorkItems`;
    const url = `${baseUrl}?${odataQuery}`;
    
    logger.debug(`Fetching from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OData query failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    const results = data.value || [];
    
    logger.info(`OData returned ${results.length} assignees`);
    
    // Extract emails and filter out GitHub Copilot and null values
    const emails: string[] = [];
    const copilotPatterns = [
      'github-copilot',
      'copilot@github.com',
      'copilot-',
      '@copilot'
    ];
    
    for (const result of results) {
      const email = result.AssignedTo?.UserEmail;
      
      // Skip null/undefined
      if (!email) continue;
      
      // Skip GitHub Copilot variants (case-insensitive)
      const emailLower = email.toLowerCase();
      if (copilotPatterns.some(pattern => emailLower.includes(pattern))) {
        logger.debug(`Filtered out GitHub Copilot: ${email}`);
        continue;
      }
      
      // Add to list if not already present
      if (!emails.includes(email)) {
        emails.push(email);
      }
    }
    
    logger.info(`Filtered to ${emails.length} unique team members (excluded GitHub Copilot and nulls)`);
    
    return {
      success: true,
      data: asToolData({
        teamMembers: emails,
        count: emails.length,
        dateRange: {
          start: startDate,
          end: endDate
        },
        areaPath: areaPath || "all",
        activeOnly
      }),
      metadata: {
        source: "odata-analytics",
        organization,
        project,
        totalResults: results.length,
        filteredCount: emails.length
      },
      errors: [],
      warnings: []
    };
    
  } catch (error) {
    logger.error('Failed to get team members:', errorToContext(error));
    return {
      success: false,
      data: null,
      metadata: { source: "odata-analytics" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
