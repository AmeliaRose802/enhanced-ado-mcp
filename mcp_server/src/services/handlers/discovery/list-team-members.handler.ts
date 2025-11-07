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
 * Uses OData Analytics to find all unique assignees
 */
async function discoverTeamMembersByWorkItems(
  organization: string,
  project: string,
  managerEmail?: string
): Promise<TeamMember[]> {
  const httpClient = createADOHttpClient(organization, getTokenProvider(), project);
  
  try {
    // Use OData Analytics to get unique assignees with work item counts
    // This discovers team composition based on actual work assignment
    const odataQuery = `$apply=filter(StateCategory ne 'Completed')/groupby((AssignedTo/UserName, AssignedTo/UserEmail), aggregate($count as Count))&$orderby=Count desc`;
    
    logger.debug(`Fetching team members via OData Analytics query`);
    
    const response = await httpClient.get<ODataResponse>(
      `_odata/v4.0-preview/WorkItems?${odataQuery}`
    );
    
    const users = response.data.value || [];
    logger.debug(`Found ${users.length} users with assigned work items`);
    
    // Convert to TeamMember format
    const teamMembers: TeamMember[] = users
      .filter(u => u.UserName && u.UserName !== 'Unassigned')
      .map(u => ({
        displayName: u.UserName,
        email: u.UserEmail || u.UserName,
        uniqueName: u.UserEmail || u.UserName,
        workItemCount: u.Count || 0
      }));
    
    // If manager email provided, filter the list
    if (managerEmail) {
      // We can't directly filter by manager in ADO, but we found all team members
      // The caller can manually filter or we return all and note the limitation
      logger.debug(`Manager filter '${managerEmail}' requested, but returning all team members (ADO limitation)`);
    }
    
    return teamMembers;
    
  } catch (error) {
    logger.warn('OData Analytics query failed, falling back to identity search', error);
    
    // Fallback: If OData fails, try broad identity search
    if (managerEmail) {
      const results = await searchIdentities(organization, managerEmail);
      if (results.length > 0) {
        return [{
          displayName: results[0].displayName,
          email: results[0].mail || results[0].uniqueName || '',
          uniqueName: results[0].uniqueName || results[0].mail || ''
        }];
      }
    }
    
    return [];
  }
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
        new Error('No team members found. Ensure the project has work items with assigned users.'),
        { 
          source: 'list-team-members',
          organization,
          project,
          hint: 'This tool discovers team members by finding users with assigned work items in the project.'
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
