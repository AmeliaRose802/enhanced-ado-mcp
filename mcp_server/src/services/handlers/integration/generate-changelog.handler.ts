/**
 * Handler for generate-changelog tool
 * Generates professional changelogs from Azure DevOps work items
 */

import type { ToolConfig, ToolExecutionResult } from "@/types/index.js";
import { asToolData } from "@/types/index.js";
import { validateAndParse } from "@/utils/handler-helpers.js";
import { getRequiredConfig } from "@/config/config.js";
import { generateChangelog } from "../../changelog-service.js";
import { logger } from "@/utils/logger.js";
import { buildSuccessResponse, buildErrorResponse } from "@/utils/response-builder.js";
import { generateChangelogSchema } from '@/config/schemas.js';
import type { z } from 'zod';
import fs from 'fs';
import path from 'path';

type GenerateChangelogArgs = z.infer<typeof generateChangelogSchema>;

export async function handleGenerateChangelog(
  config: ToolConfig,
  args: unknown
): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }

    const parsed = validation.data as GenerateChangelogArgs;
    const requiredConfig = getRequiredConfig();

    // Validate that at least one time range is provided
    if (!parsed.dateRangeStart && !parsed.dateRangeEnd && !parsed.iterationPath) {
      return buildErrorResponse(
        'At least one time range parameter is required: dateRangeStart, dateRangeEnd, or iterationPath',
        { source: 'generate-changelog' }
      );
    }

    const changelogOptions = {
      organization: parsed.organization || requiredConfig.organization,
      project: parsed.project || requiredConfig.project,
      dateRangeStart: parsed.dateRangeStart,
      dateRangeEnd: parsed.dateRangeEnd,
      iterationPath: parsed.iterationPath,
      states: parsed.states,
      includeTypes: parsed.includeTypes,
      excludeTypes: parsed.excludeTypes,
      tags: parsed.tags,
      areaPathFilter: parsed.areaPathFilter || requiredConfig.defaultAreaPaths,
      groupBy: parsed.groupBy,
      format: parsed.format,
      includeWorkItemLinks: parsed.includeWorkItemLinks,
      includeDescriptions: parsed.includeDescriptions,
      includeAssignees: parsed.includeAssignees,
      typeMapping: parsed.typeMapping,
      version: parsed.version
    };

    logger.info(`Generating changelog with format '${changelogOptions.format}' and groupBy '${changelogOptions.groupBy}'`);

    const { changelog, entryCount, groups } = await generateChangelog(changelogOptions);

    // Write to file if outputPath is provided
    if (parsed.outputPath) {
      const absolutePath = path.isAbsolute(parsed.outputPath)
        ? parsed.outputPath
        : path.join(process.cwd(), parsed.outputPath);

      if (parsed.append && fs.existsSync(absolutePath)) {
        // Append to existing file
        const existingContent = fs.readFileSync(absolutePath, 'utf-8');
        const newContent = existingContent + '\n\n' + changelog;
        fs.writeFileSync(absolutePath, newContent, 'utf-8');
        logger.info(`Appended changelog to ${absolutePath}`);
      } else {
        // Write/overwrite file
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(absolutePath, changelog, 'utf-8');
        logger.info(`Wrote changelog to ${absolutePath}`);
      }

      return buildSuccessResponse(
        asToolData({
          success: true,
          filePath: absolutePath,
          entryCount,
          groupCount: groups.length,
          groups: groups.map(g => ({
            category: g.category,
            entryCount: g.entries.length
          })),
          message: `Changelog ${parsed.append ? 'appended to' : 'written to'} ${absolutePath}`
        }),
        {
          source: 'generate-changelog',
          operation: 'file-write'
        }
      );
    }

    // Return changelog as text
    return buildSuccessResponse(
      asToolData({
        success: true,
        changelog,
        entryCount,
        groupCount: groups.length,
        groups: groups.map(g => ({
          category: g.category,
          entryCount: g.entries.length,
          entries: g.entries.map(e => ({
            id: e.id,
            title: e.title,
            type: e.type,
            url: e.url
          }))
        }))
      }),
      {
        source: 'generate-changelog',
        operation: 'in-memory'
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to generate changelog', { error: errorMessage });
    return buildErrorResponse(
      `Failed to generate changelog: ${errorMessage}`,
      { source: 'generate-changelog' }
    );
  }
}
