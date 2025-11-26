/**
 * Changelog Generation Service
 * Generates professional changelogs from Azure DevOps work items
 */

import { logger } from '../utils/logger.js';
import { queryWorkItemsByWiql } from './ado-work-item-service.js';

export interface ChangelogEntry {
  id: number;
  title: string;
  type: string;
  state: string;
  assignedTo?: string;
  closedDate?: string;
  description?: string;
  url: string;
  tags?: string[];
  priority?: number;
}

export interface ChangelogGroup {
  category: string;
  entries: ChangelogEntry[];
}

export interface GenerateChangelogOptions {
  organization: string;
  project: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  iterationPath?: string;
  states?: string[];
  includeTypes?: string[];
  excludeTypes?: string[];
  tags?: string[];
  areaPathFilter?: string[];
  groupBy?: 'type' | 'assignee' | 'priority' | 'tag' | 'none';
  format?: 'markdown' | 'keepachangelog' | 'conventional' | 'semantic' | 'json';
  includeWorkItemLinks?: boolean;
  includeDescriptions?: boolean;
  includeAssignees?: boolean;
  typeMapping?: Record<string, string>;
  version?: string;
}

/**
 * Strip HTML tags from string
 */
function stripHtml(html?: string): string | undefined {
  if (!html) return undefined;
  // Simple HTML tag removal (basic implementation)
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Default type mapping for changelog categories
 */
const DEFAULT_TYPE_MAPPING: Record<string, string> = {
  'Bug': '🐛 Bug Fixes',
  'Task': '✨ Improvements',
  'Product Backlog Item': '✨ Features',
  'Feature': '🚀 Features',
  'Epic': '🎯 Epics',
  'User Story': '📖 User Stories',
  'Issue': '🐛 Bug Fixes',
  'Impediment': '🚧 Blockers',
  'Test Case': '🧪 Testing'
};

/**
 * Build WIQL query for changelog generation
 */
function buildChangelogQuery(options: GenerateChangelogOptions): string {
  const {
    project,
    dateRangeStart,
    dateRangeEnd,
    iterationPath,
    states = ['Closed', 'Resolved'],
    includeTypes,
    excludeTypes,
    tags,
    areaPathFilter
  } = options;

  const conditions: string[] = [];

  // Project scope
  conditions.push(`[System.TeamProject] = '${project}'`);

  // State filter
  if (states.length === 1) {
    conditions.push(`[System.State] = '${states[0]}'`);
  } else if (states.length > 1) {
    const stateConditions = states.map(s => `[System.State] = '${s}'`).join(' OR ');
    conditions.push(`(${stateConditions})`);
  }

  // Date range filter (use ClosedDate for completed items)
  if (dateRangeStart) {
    conditions.push(`[Microsoft.VSTS.Common.ClosedDate] >= '${dateRangeStart}'`);
  }
  if (dateRangeEnd) {
    conditions.push(`[Microsoft.VSTS.Common.ClosedDate] <= '${dateRangeEnd}'`);
  }

  // Iteration path filter
  if (iterationPath) {
    conditions.push(`[System.IterationPath] = '${iterationPath}'`);
  }

  // Area path filter
  if (areaPathFilter && areaPathFilter.length > 0) {
    if (areaPathFilter.length === 1) {
      conditions.push(`[System.AreaPath] UNDER '${areaPathFilter[0]}'`);
    } else {
      const areaConditions = areaPathFilter.map(ap => `[System.AreaPath] UNDER '${ap}'`).join(' OR ');
      conditions.push(`(${areaConditions})`);
    }
  }

  // Type filters
  if (includeTypes && includeTypes.length > 0) {
    if (includeTypes.length === 1) {
      conditions.push(`[System.WorkItemType] = '${includeTypes[0]}'`);
    } else {
      const typeConditions = includeTypes.map(t => `[System.WorkItemType] = '${t}'`).join(' OR ');
      conditions.push(`(${typeConditions})`);
    }
  }

  if (excludeTypes && excludeTypes.length > 0) {
    const excludeConditions = excludeTypes.map(t => `[System.WorkItemType] <> '${t}'`).join(' AND ');
    conditions.push(`(${excludeConditions})`);
  }

  // Tag filter
  if (tags && tags.length > 0) {
    const tagConditions = tags.map(tag => `[System.Tags] CONTAINS '${tag}'`).join(' OR ');
    conditions.push(`(${tagConditions})`);
  }

  const whereClause = conditions.join(' AND ');
  const query = `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], [System.AssignedTo], [System.Tags], [Microsoft.VSTS.Common.Priority], [Microsoft.VSTS.Common.ClosedDate], [System.Description] FROM WorkItems WHERE ${whereClause} ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC`;

  logger.debug(`Generated changelog WIQL query: ${query}`);
  return query;
}

/**
 * Convert work item to changelog entry
 */
function workItemToEntry(
  item: any, // WiqlWorkItemResult from query
  organization: string,
  includeDescriptions: boolean
): ChangelogEntry {
  const url = `https://dev.azure.com/${organization}/_workitems/edit/${item.id}`;
  
  let description: string | undefined;
  if (includeDescriptions && item.additionalFields?.['System.Description']) {
    const descField = item.additionalFields['System.Description'];
    // Strip HTML if present
    description = typeof descField === 'string' && descField.includes('<') 
      ? stripHtml(descField) 
      : String(descField);
  }

  // Parse tags if present
  let tags: string[] | undefined;
  if (item.tags) {
    tags = typeof item.tags === 'string' ? item.tags.split(';').map((t: string) => t.trim()) : undefined;
  }

  return {
    id: item.id as number,
    title: item.title,
    type: item.type,
    state: item.state,
    assignedTo: item.assignedTo,
    closedDate: item.additionalFields?.['Microsoft.VSTS.Common.ClosedDate'] as string | undefined,
    description,
    url,
    tags,
    priority: item.additionalFields?.['Microsoft.VSTS.Common.Priority'] as number | undefined
  };
}

/**
 * Group changelog entries by specified criteria
 */
function groupEntries(
  entries: ChangelogEntry[],
  groupBy: 'type' | 'assignee' | 'priority' | 'tag' | 'none',
  typeMapping: Record<string, string>
): ChangelogGroup[] {
  if (groupBy === 'none') {
    return [{ category: 'Changes', entries }];
  }

  const groups = new Map<string, ChangelogEntry[]>();

  for (const entry of entries) {
    let key: string;

    switch (groupBy) {
      case 'type':
        key = typeMapping[entry.type] || entry.type;
        break;
      case 'assignee':
        key = entry.assignedTo || 'Unassigned';
        break;
      case 'priority':
        key = entry.priority !== undefined ? `Priority ${entry.priority}` : 'No Priority';
        break;
      case 'tag':
        key = entry.tags && entry.tags.length > 0 ? entry.tags[0] : 'Untagged';
        break;
      default:
        key = 'Changes';
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(entry);
  }

  // Convert to array and sort by category name
  return Array.from(groups.entries())
    .map(([category, entries]) => ({ category, entries }))
    .sort((a, b) => {
      // Sort features/bug fixes to top
      const priorityOrder = ['Features', 'Bug Fixes', 'Improvements'];
      const aIdx = priorityOrder.findIndex(p => a.category.includes(p));
      const bIdx = priorityOrder.findIndex(p => b.category.includes(p));
      
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      
      return a.category.localeCompare(b.category);
    });
}

/**
 * Format entry as markdown list item
 */
function formatEntryMarkdown(
  entry: ChangelogEntry,
  includeWorkItemLinks: boolean,
  includeAssignees: boolean,
  includeDescriptions: boolean
): string {
  let line = '- ';
  
  // Title
  line += entry.title;
  
  // Work item link
  if (includeWorkItemLinks) {
    line += ` ([#${entry.id}](${entry.url}))`;
  } else {
    line += ` (#${entry.id})`;
  }
  
  // Assignee
  if (includeAssignees && entry.assignedTo) {
    line += ` - @${entry.assignedTo}`;
  }
  
  // Description
  if (includeDescriptions && entry.description) {
    const desc = entry.description.trim().split('\n')[0]; // First line only
    if (desc.length > 100) {
      line += `\n  ${desc.substring(0, 100)}...`;
    } else {
      line += `\n  ${desc}`;
    }
  }
  
  return line;
}

/**
 * Format changelog in Keep a Changelog format
 */
function formatKeepAChangelog(
  groups: ChangelogGroup[],
  version: string | undefined,
  includeWorkItemLinks: boolean,
  includeAssignees: boolean,
  includeDescriptions: boolean
): string {
  const lines: string[] = [];
  
  // Header
  lines.push('# Changelog\n');
  lines.push('All notable changes to this project will be documented in this file.\n');
  lines.push('The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).\n');
  
  // Version header
  const versionTag = version || 'Unreleased';
  const dateStr = new Date().toISOString().split('T')[0];
  lines.push(`## [${versionTag}] - ${dateStr}\n`);
  
  // Groups
  for (const group of groups) {
    lines.push(`### ${group.category}\n`);
    for (const entry of group.entries) {
      lines.push(formatEntryMarkdown(entry, includeWorkItemLinks, includeAssignees, includeDescriptions));
    }
    lines.push(''); // Blank line between groups
  }
  
  return lines.join('\n');
}

/**
 * Format changelog in Conventional Commits format
 */
function formatConventional(
  groups: ChangelogGroup[],
  version: string | undefined,
  includeWorkItemLinks: boolean,
  includeAssignees: boolean,
  includeDescriptions: boolean
): string {
  const lines: string[] = [];
  
  // Version header
  const versionTag = version || 'unreleased';
  const dateStr = new Date().toISOString().split('T')[0];
  lines.push(`# ${versionTag} (${dateStr})\n`);
  
  // Map categories to conventional commit types
  const conventionalTypeMap: Record<string, string> = {
    'Features': 'feat',
    'Bug Fixes': 'fix',
    'Improvements': 'refactor',
    'Documentation': 'docs',
    'Testing': 'test',
    'Chores': 'chore'
  };
  
  // Groups
  for (const group of groups) {
    const conventionalType = Object.keys(conventionalTypeMap).find(k => group.category.includes(k));
    const typePrefix = conventionalType ? conventionalTypeMap[conventionalType] : 'feat';
    
    lines.push(`### ${group.category}\n`);
    for (const entry of group.entries) {
      const scope = entry.tags && entry.tags.length > 0 ? `(${entry.tags[0]})` : '';
      lines.push(`- **${typePrefix}${scope}:** ${formatEntryMarkdown(entry, includeWorkItemLinks, includeAssignees, includeDescriptions).substring(2)}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Format changelog as JSON
 */
function formatJSON(
  groups: ChangelogGroup[],
  version: string | undefined
): string {
  const dateStr = new Date().toISOString().split('T')[0];
  
  const output = {
    version: version || 'unreleased',
    date: dateStr,
    groups: groups.map(g => ({
      category: g.category,
      entries: g.entries.map(e => ({
        id: e.id,
        title: e.title,
        type: e.type,
        state: e.state,
        url: e.url,
        assignedTo: e.assignedTo,
        closedDate: e.closedDate,
        description: e.description,
        tags: e.tags,
        priority: e.priority
      }))
    }))
  };
  
  return JSON.stringify(output, null, 2);
}

/**
 * Generate changelog from work items
 */
export async function generateChangelog(
  options: GenerateChangelogOptions
): Promise<{ changelog: string; entryCount: number; groups: ChangelogGroup[] }> {
  const {
    organization,
    project,
    groupBy = 'type',
    format = 'keepachangelog',
    includeWorkItemLinks = true,
    includeDescriptions = false,
    includeAssignees = false,
    typeMapping,
    version
  } = options;

  logger.info(`Generating changelog for ${organization}/${project}`);

  // Build and execute WIQL query
  const wiqlQuery = buildChangelogQuery(options);
  
  // Query with proper arguments object
  const result = await queryWorkItemsByWiql({
    wiqlQuery,
    organization,
    project,
    includeFields: [
      'System.Description',
      'Microsoft.VSTS.Common.ClosedDate',
      'Microsoft.VSTS.Common.Priority',
      'System.Tags'
    ]
  });

  if (result.workItems.length === 0) {
    logger.warn('No work items found for changelog generation');
    return {
      changelog: '# Changelog\n\nNo changes found for the specified criteria.',
      entryCount: 0,
      groups: []
    };
  }

  logger.info(`Found ${result.workItems.length} work items for changelog`);

  // Convert to changelog entries
  const entries = result.workItems.map((item: any) => workItemToEntry(item, organization, includeDescriptions));

  // Merge custom type mapping with defaults
  const effectiveTypeMapping = { ...DEFAULT_TYPE_MAPPING, ...(typeMapping || {}) };

  // Group entries
  const groups = groupEntries(entries, groupBy, effectiveTypeMapping);

  // Format based on selected format
  let changelog: string;
  switch (format) {
    case 'conventional':
      changelog = formatConventional(groups, version, includeWorkItemLinks, includeAssignees, includeDescriptions);
      break;
    case 'json':
      changelog = formatJSON(groups, version);
      break;
    case 'keepachangelog':
    case 'markdown':
    case 'semantic':
    default:
      changelog = formatKeepAChangelog(groups, version, includeWorkItemLinks, includeAssignees, includeDescriptions);
      break;
  }

  return {
    changelog,
    entryCount: entries.length,
    groups
  };
}
