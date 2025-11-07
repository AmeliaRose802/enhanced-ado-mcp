/**
 * Handler for wit-list-team-members tool
 * Discovers team members by analyzing work item assignments in Azure DevOps
 */

import type { ToolExecutionResult } from "@/types/index.js";
import { getRequiredConfig } from "@/config/config.js";
import { logger } from "@/utils/logger.js";
import { listTeamMembersSchema } from "@/config/schemas.js";
import { 
  buildValidationErrorResponse, 
  buildErrorResponse, 
  buildSuccessResponse 
} from "@/utils/response-builder.js";
import { searchIdentities } from "@/services/ado-identity-service.js";
import { createADOHttpClient } from "@/utils/ado-http-client.js";
import { getTokenProvider } from "@/utils/token-provider.js";
import { z } from "zod";

type ListTeamMembersInput = z.infer<typeof listTeamMembersSchema>;

interface TeamMember {
  displayName: string;
  email: string;
  uniqueName: string;
  workItemCount?: number;
}

interface ODataUser {
  UserName: string;
  UserEmail?: string;
  Count?: number;
}

interface ODataResponse {
  '@odata.context'?: string;
  value: ODataUser[];
}

/**
 * Discover team members by querying work items assigned to users
 * Uses multiple strategies with fallbacks for maximum reliability
 */
async function discoverTeamMembersByWorkItems(
  organization: string,
  project: string,
  managerEmail?: string
): Promise<TeamMember[]> {
  const httpClient = createADOHttpClient(organization, getTokenProvider(), project);
  
  // Strategy 1: Try OData with broader filter (last 6 months, all states)
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dateFilter = sixMonthsAgo.toISOString().split('T')[0] + 'Z';
    
    const odataQuery = `$apply=filter(ChangedDate ge ${dateFilter})/groupby((AssignedTo/UserName, AssignedTo/UserEmail), aggregate($count as Count))&$orderby=Count desc&$top=100`;
    
    logger.debug(`Strategy 1: OData Analytics with 6-month filter`);
    
    const response = await httpClient.get<ODataResponse>(
      `_odata/v4.0-preview/WorkItems?${odataQuery}`
    );
    
    const users = response.data.value || [];
    logger.debug(`OData Strategy 1 found ${users.length} users`);
    
    if (users.length > 0) {
      const teamMembers = users
        .filter(u => u.UserName && u.UserName !== 'Unassigned')
        .map(u => ({
          displayName: u.UserName,
          email: u.UserEmail || u.UserName,
          uniqueName: u.UserEmail || u.UserName,
          workItemCount: u.Count || 0
        }));
      
      if (teamMembers.length > 0) {
        return teamMembers;
      }
    }
  } catch (error) {
    logger.warn('OData Strategy 1 failed, trying fallback', error);
  }
  
  // Strategy 2: Try simpler OData without date filter
  try {
    const odataQuery = `$apply=groupby((AssignedTo/UserName, AssignedTo/UserEmail), aggregate($count as Count))&$orderby=Count desc&$top=100`;
    
    logger.debug(`Strategy 2: OData Analytics without date filter`);
    
    const response = await httpClient.get<ODataResponse>(
      `_odata/v4.0-preview/WorkItems?${odataQuery}`
    );
    
    const users = response.data.value || [];
    logger.debug(`OData Strategy 2 found ${users.length} users`);
    
    if (users.length > 0) {
      const teamMembers = users
        .filter(u => u.UserName && u.UserName !== 'Unassigned')
        .map(u => ({
          displayName: u.UserName,
          email: u.UserEmail || u.UserName,
          uniqueName: u.UserEmail || u.UserName,
          workItemCount: u.Count || 0
        }));
      
      if (teamMembers.length > 0) {
        return teamMembers;
      }
    }
  } catch (error) {
    logger.warn('OData Strategy 2 failed, trying WIQL fallback', error);
  }
  
  // Strategy 3: Use WIQL to find assigned work items
  try {
    logger.debug(`Strategy 3: WIQL query for recent assignments`);
    
    const wiqlQuery = `SELECT [System.AssignedTo] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [System.AssignedTo] <> '' ORDER BY [System.ChangedDate] DESC`;
    
    const wiqlResponse = await httpClient.post<any>(
      `wit/wiql?api-version=7.1`,
      { query: wiqlQuery }
    );
    
    const workItems = wiqlResponse.data.workItems || [];
    logger.debug(`WIQL found ${workItems.length} work items with assignments`);
    
    if (workItems.length > 0) {
      // Get unique work item IDs
      const workItemIds = workItems.slice(0, 200).map((wi: any) => wi.id);
      
      // Fetch work items to get assignee details
      const batchResponse = await httpClient.get<any>(
        `wit/workitems?ids=${workItemIds.join(',')}&fields=System.AssignedTo&api-version=7.1`
      );
      
      const items = batchResponse.data.value || [];
      logger.debug(`Fetched ${items.length} work items for assignee extraction`);
      
      // Extract unique assignees
      const assigneeMap = new Map<string, TeamMember>();
      
      for (const item of items) {
        const assignedTo = item.fields?.['System.AssignedTo'];
        if (assignedTo && assignedTo.uniqueName && assignedTo.displayName) {
          const key = assignedTo.uniqueName.toLowerCase();
          const existing = assigneeMap.get(key);
          
          assigneeMap.set(key, {
            displayName: assignedTo.displayName,
            email: assignedTo.uniqueName,
            uniqueName: assignedTo.uniqueName,
            workItemCount: existing ? existing.workItemCount! + 1 : 1
          });
        }
      }
      
      const teamMembers = Array.from(assigneeMap.values())
        .sort((a, b) => (b.workItemCount || 0) - (a.workItemCount || 0));
      
      if (teamMembers.length > 0) {
        logger.debug(`WIQL strategy found ${teamMembers.length} unique assignees`);
        return teamMembers;
      }
    }
  } catch (error) {
    logger.warn('WIQL Strategy 3 failed, trying identity search', error);
  }
  
  // Strategy 4: Fallback to identity search if manager provided
  if (managerEmail) {
    try {
      logger.debug(`Strategy 4: Identity search for '${managerEmail}'`);
      const results = await searchIdentities(organization, managerEmail);
      
      if (results.length > 0) {
        return results.slice(0, 20).map(r => ({
          displayName: r.displayName,
          email: r.mail || r.uniqueName || '',
          uniqueName: r.uniqueName || r.mail || ''
        }));
      }
    } catch (error) {
      logger.warn('Identity search failed', error);
    }
  }
  
  return [];
}

/**
 * List team members by discovering users with assigned work
 * Optionally filter by manager (though ADO doesn't support this natively)
 */
export async function handleListTeamMembers(args: unknown): Promise<ToolExecutionResult> {
  try {
    // Parse and validate input
    const parsed = listTeamMembersSchema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error, 'list-team-members');
    }

    const input = parsed.data as ListTeamMembersInput;
    
    // Get configuration with auto-fill
    const requiredConfig = getRequiredConfig();
    const organization = input.organization || requiredConfig.organization;
    const project = requiredConfig.project;
    const outputFormat = input.outputFormat || 'detailed';
    const includeManager = input.includeManager || false;

    logger.debug(`Discovering team members in ${organization}/${project}`);

    // Discover team members by analyzing work item assignments
    let teamMembers = await discoverTeamMembersByWorkItems(
      organization,
      project,
      input.managerEmail
    );
    
    if (teamMembers.length === 0) {
      return buildErrorResponse(
        new Error('No team members found after trying multiple discovery strategies.'),
        { 
          source: 'list-team-members',
          organization,
          project,
          strategiesTried: [
            '1. OData Analytics with 6-month filter',
            '2. OData Analytics without filters',
            '3. WIQL query for work item assignments',
            '4. Identity search (if manager email provided)'
          ],
          possibleReasons: [
            'Project has no work items with assigned users',
            'OData Analytics not enabled or no permissions',
            'Work items use non-standard assignment fields',
            'All work items are unassigned'
          ],
          workarounds: [
            'Manually provide team member emails in WIQL: WHERE [System.AssignedTo] IN (\'email1\', \'email2\')',
            'Use area path filtering: WHERE [System.AreaPath] UNDER \'Project\\\\Team\'',
            'Check Azure DevOps Analytics permissions',
            'Try wit-search-users tool to find specific users'
          ]
        }
      );
    }

    // If manager email provided and includeManager is false, try to filter them out
    if (input.managerEmail && !includeManager) {
      const managerLower = input.managerEmail.toLowerCase();
      teamMembers = teamMembers.filter(m => 
        !m.email.toLowerCase().includes(managerLower) &&
        !m.uniqueName.toLowerCase().includes(managerLower)
      );
    }

    logger.debug(`Found ${teamMembers.length} team members`);

    // Return result based on output format
    if (outputFormat === 'emails') {
      // Return comma-separated email list for WIQL IN queries
      const emailList = teamMembers
        .map(m => `'${m.email}'`)
        .join(', ');
      
      return buildSuccessResponse(
        {
          emailList,
          count: teamMembers.length,
          usage: `Use in WIQL: WHERE [System.AssignedTo] IN (${emailList})`,
          note: 'Team members discovered by analyzing current work item assignments in the project.'
        },
        { 
          source: 'list-team-members',
          organization,
          project,
          outputFormat
        }
      );
    }

    // Detailed format
    return buildSuccessResponse(
      {
        teamMembers,
        count: teamMembers.length,
        discoveryMethod: 'Analyzed work item assignments in project to discover active team members',
        note: 'Azure DevOps Graph API does not expose manager/direct report relationships. This tool discovers team members by finding users with assigned work items.',
        managerFilter: input.managerEmail 
          ? `Attempted to filter by manager '${input.managerEmail}', but returning all team members (ADO limitation)`
          : null
      },
      { 
        source: 'list-team-members',
        organization,
        project,
        outputFormat
      }
    );

  } catch (error) {
    logger.error('Failed to list team members', error);
    return buildErrorResponse(
      error as Error,
      { source: 'list-team-members' }
    );
  }
}
