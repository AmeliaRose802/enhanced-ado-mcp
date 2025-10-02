# Prompt Cleanup Summary - October 1, 2025

## Overview
Comprehensive cleanup of prompt templates to eliminate overlap, simplify arguments, and integrate new substantive change analysis tools.

## Changes Made

### 1. Deprecated Overlapping Prompts

**ai_suitability_analyzer.md** - DEPRECATED (v2)
- Marked with deprecation notice at top
- Users directed to use i_assignment_analyzer instead
- Kept for backward compatibility only
- Will be removed in future version

**Rationale:** We had 3 overlapping AI assignment analyzers:
- i_suitability_analyzer (basic JSON output)
- i_assignment_analyzer (enhanced with confidence scoring)
- intelligent_work_item_analyzer (includes AI readiness as part of comprehensive analysis)

The enhanced i_assignment_analyzer provides superior functionality with detailed reasoning, confidence scores, and actionable recommendations.

### 2. Simplified parallel_fit_planner (v3 → v4)

**Arguments Simplified:**
- Kept only: parent_work_item_id
- Removed unused template variable references in body
- Auto-populated config values used instead

**Tools Updated:**
- Organized into logical categories (Discovery vs Actions)
- Added wit-get-last-substantive-change-bulk for activity assessment
- Added wit-ai-assignment-analyzer for detailed analysis
- Removed redundant tool descriptions

**Workflow Streamlined:**
- Removed Project/Area Path/Organization template vars
- Simplified instructions to 7 clear steps
- Focus on action over configuration

### 3. Added New Tools to All Prompts

**Substantive Change Tools (NEW):**
- wit-get-last-substantive-change - Single item true activity analysis
- wit-get-last-substantive-change-bulk - Bulk analysis (up to 100 items)

These tools filter out automated iteration/area path updates to identify genuinely stale vs recently touched items.

**Discovery & Context Tools:**
- wit-get-work-items-by-query-wiql - Added to prompts that didn't have it
- wit-get-work-items-context-batch - Added for batch operations
- wit-get-work-item-context-package - Added for deep dives

**Prompts Updated:**
- ✅ parallel_fit_planner - Added substantive change + discovery tools
- ✅ intelligent_work_item_analyzer - Added substantive change tools
- ✅ eature_decomposer - Added query/batch tools
- ✅ security_items_analyzer - Added discovery tools
- ✅ work_item_enhancer - Added query tools for similarity checks
- ✅ ind_dead_items - Already had substantive change tools
- ✅ acklog_cleanup - Already had substantive change tools

### 4. Updated README.md

**Tools Section:**
- Added tools 11-14 (batch, context, substantive change tools)
- Better organization and descriptions

**Prompts Section:**
- Listed all 10 prompts with clear descriptions
- Marked i_suitability_analyzer as deprecated
- Added strikethrough formatting for deprecated items

## Files Modified

1. mcp_server/prompts/parallel_fit_planner.md - Simplified (v3 → v4)
2. mcp_server/prompts/ai_suitability_analyzer.md - Deprecated with notice
3. mcp_server/prompts/intelligent_work_item_analyzer.md - Added tools
4. mcp_server/prompts/feature_decomposer.md - Added query tools
5. mcp_server/prompts/security_items_analyzer.md - Added discovery tools
6. mcp_server/prompts/work_item_enhancer.md - Added query tools
7. README.md - Updated tools list and prompts inventory

## Files Preserved (Unchanged)

**System Prompts (in prompts/system/):**
- All 8 system prompts preserved unchanged
- These are used internally by intelligent tools
- Not user-facing, so not included in cleanup

**Already Clean Prompts:**
- ind_dead_items.md - Recently updated, already has new tools
- acklog_cleanup.md - Recently simplified
- hierarchy_validator.md - Recently simplified

## Benefits

1. **Reduced Confusion** - Clear deprecation path, users know which tool to use
2. **Simpler Interfaces** - Fewer arguments, auto-populated defaults
3. **Better Tool Coverage** - All prompts now reference latest tools
4. **Consistent Patterns** - Similar prompts follow similar structure
5. **True Staleness** - Substantive change tools provide accurate activity assessment
6. **Context Window Protection** - ⚠️ Warnings added to prevent context overflow from batch/context-package tools

## Context Window Management (Added)

All prompts now include warnings about context-consuming tools:

**High Context Tools:**
- `wit-get-work-item-context-package` - ⚠️ Large payload, use for 1-3 items max
- `wit-get-work-items-context-batch` - ⚠️ Varies by use case:
  - **Backlog cleanup/dead items**: 20-30 items max
  - **Hierarchy validation**: 15-25 items max
  - **Feature decomposition**: 10-15 items max
  - **Security analysis**: 20-25 items max
  - **Duplicate checking**: 5-10 items max

**Safe for Large Sets:**
- `wit-get-last-substantive-change-bulk` - Lightweight, safe for 50-100+ items
- `wit-get-work-items-by-query-wiql` - Returns IDs only, very efficient

**Best Practice:** Use WIQL to get IDs, then use substantive change tools for filtering, and only pull full context for final analysis subset.

## Migration Guide

### For ai_suitability_analyzer Users

**Before:**
`json
{
  "prompt": "ai_suitability_analyzer",
  "arguments": {
    "work_item_id": "12345"
  }
}
`

**After:**
`json
{
  "prompt": "ai_assignment_analyzer",
  "arguments": {
    "work_item_id": "12345"
  }
}
`

**Benefits of Migration:**
- Confidence scoring (0-100)
- Detailed reasoning and recommendations
- Risk factor analysis
- Missing information identification
- Actionable next steps

### For parallel_fit_planner Users

No breaking changes - same argument signature. Enhanced internally with:
- True activity analysis (filters iteration churn)
- Better AI suitability assessment
- Improved tool organization

## Next Steps

1. **Monitor Usage** - Track deprecation warning visibility
2. **Update Internal Tools** - Update any tools calling i_suitability_analyzer
3. **Future Removal** - Remove i_suitability_analyzer in v2.0
4. **Testing** - Verify all prompts work with new tool references

## Related Documents

- specs/AUTOMATED_CHANGE_FILTERING.md - Substantive change filtering details
- specs/LAST_SUBSTANTIVE_CHANGE_TOOL.md - Tool specifications
- specs/PROMPT_SYSTEM.md - Overall prompt system architecture
