# Archived Prompts

These prompts have been consolidated into unified versions for better maintainability and clearer user experience.

## Consolidation History

### October 6, 2025 - Work Item Analysis Consolidation

**Replaced by:** `unified_work_item_analyzer.md`

**Archived Prompts:**
- `work_item_enhancer.md` - Enhancement recommendations for execution readiness
- `intelligent_work_item_analyzer.md` - AI-powered quality and completeness analysis  
- `ai_assignment_analyzer.md` - AI vs human assignment suitability evaluation

**Rationale:** These three prompts had significant overlap in:
- All analyzed individual work items for quality/readiness
- All provided recommendations for improvement
- Similar tool usage patterns (fetch context → analyze → recommend)
- Overlapping concerns around completeness, clarity, and AI-readiness

**Benefits of Consolidation:**
- Single entry point with `analysis_mode` parameter (enhancement, ai-assignment, intelligent-full, quick)
- Consistent analysis patterns across modes
- Reduced maintenance burden (update logic in one place)
- Clearer for users - no confusion about which analyzer to use

---

### October 6, 2025 - Hierarchy Management Consolidation

**Replaced by:** `unified_hierarchy_manager.md`

**Archived Prompts:**
- `hierarchy_analyzer.md` - Hierarchy structure validation and health assessment
- `child_item_optimizer.md` - Child item analysis, optimization, and parallel execution planning

**Rationale:** These two prompts both focused on parent-child work item relationships with overlap in:
- Both analyzed parent-child work item relationships
- Both validated structural integrity
- Both provided optimization recommendations
- Focus on tree/hierarchy health

**Benefits of Consolidation:**
- Single entry point with `management_mode` parameter (analyze, optimize-children, full)
- Clearer separation between structural validation and execution optimization
- Unified approach to hierarchy operations
- Can combine both analyses for comprehensive management (full mode)

---

## Migration Guide

### For `work_item_enhancer.md` users:
```yaml
# Old
name: work_item_enhancer
arguments:
  work_item_id: "12345"

# New
name: unified_work_item_analyzer
arguments:
  work_item_id: "12345"
  analysis_mode: "enhancement"  # This is the default
```

### For `intelligent_work_item_analyzer.md` users:
```yaml
# Old
name: intelligent_work_item_analyzer
arguments:
  work_item_id: "12345"
  analysis_focus: "full"

# New
name: unified_work_item_analyzer
arguments:
  work_item_id: "12345"
  analysis_mode: "intelligent-full"
```

### For `ai_assignment_analyzer.md` users:
```yaml
# Old
name: ai_assignment_analyzer
arguments:
  work_item_id: "12345"
  output_format: "detailed"

# New
name: unified_work_item_analyzer
arguments:
  work_item_id: "12345"
  analysis_mode: "ai-assignment"
  output_format: "detailed"
```

### For `hierarchy_analyzer.md` users:
```yaml
# Old
name: hierarchy_analyzer
arguments:
  parent_work_item_id: "12345"

# New
name: unified_hierarchy_manager
arguments:
  root_work_item_id: "12345"
  management_mode: "analyze"  # This is the default
```

### For `child_item_optimizer.md` users:
```yaml
# Old
name: child_item_optimizer
arguments:
  parent_work_item_id: "12345"
  auto_enhance: true

# New
name: unified_hierarchy_manager
arguments:
  root_work_item_id: "12345"
  management_mode: "optimize-children"
  auto_enhance: true
```

---

## Future Consolidation Candidates

Based on the analysis in `tasklist/prompt-cleanup-suggestions.md`, these prompts are candidates for future consolidation but were kept separate for now:

### Project Planning Suite (Not Consolidated)
- `parallel_fit_planner.md`
- `project_completion_planner.md`
- `team_velocity_analyzer.md`

**Reason for keeping separate:** These operate at project/team level rather than individual work items, have different audiences (PM/scrum master vs developer), and may be distinct enough to warrant separate prompts.

### Specialized Tools (Keep Separate)
- `backlog_cleanup.md` - Unique maintenance function
- `security_items_analyzer.md` - Domain-specific security analysis

**Reason for keeping separate:** These serve distinct, specialized purposes with minimal overlap with other prompts.

---

## Restoring Archived Prompts

If you need to restore an archived prompt for any reason:

```bash
# From the repository root
git mv mcp_server/prompts/archived/[prompt-name].md mcp_server/prompts/
```

Or simply reference the archived versions directly - they remain functional, just not the recommended approach going forward.
