# Prompt Updates - Done State Exclusion

**Date:** October 1, 2025  
**Commit:** 20b8985

## Summary

Updated all 18 prompt files to ensure AI analysis tools **never flag or analyze work items in Done states**. This prevents the tools from wasting time analyzing successfully completed work and ensures they focus only on active work items that need attention.

## Changes Made

### 1. WIQL Query Updates

All WIQL query examples updated from:
```wiql
WHERE [System.State] <> 'Removed'
```

To:
```wiql
WHERE [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed')
```

This ensures queries automatically filter out all variations of "Done" states.

### 2. Default Parameter Updates

**hierarchy_validator.md:**
- Updated `exclude_states` default parameter from:
  - `["Done", "Closed", "Removed"]`
- To:
  - `["Done", "Closed", "Removed", "Completed", "Resolved"]`

### 3. Explicit Documentation

Added clear notes to all prompts:
- **Main prompts**: Added "Important" sections stating that Done/Completed/Closed/Resolved states should be excluded
- **System prompts**: Added **IMPORTANT** banner at the beginning noting Done state exclusion

## Files Updated

### Main Prompts (10 files)
1. `ai_assignment_analyzer.md` - Added Done state exclusion note and updated WIQL
2. `ai_suitability_analyzer.md` - Added note for active work items only
3. `backlog_cleanup.md` - Updated WIQL and added exclusion note
4. `feature_decomposer.md` - Added note and updated child item WIQL
5. `find_dead_items.md` - Updated WIQL to exclude Done states
6. `hierarchy_validator.md` - Updated default parameter, WIQL examples, and added note
7. `intelligent_work_item_analyzer.md` - Added note and updated duplicate detection WIQL
8. `parallel_fit_planner.md` - Updated child discovery WIQL and added note
9. `security_items_analyzer.md` - Updated security item WIQL and added note
10. `work_item_enhancer.md` - Added note about active work items only

### System Prompts (8 files)
1. `system/ai-assignment-analyzer.md` - Added **IMPORTANT** banner
2. `system/ai-readiness-analyzer.md` - Added **IMPORTANT** banner
3. `system/categorization-analyzer.md` - Added **IMPORTANT** banner
4. `system/completeness-analyzer.md` - Added **IMPORTANT** banner
5. `system/enhancement-analyzer.md` - Added **IMPORTANT** banner
6. `system/feature-decomposer.md` - Added **IMPORTANT** banner
7. `system/full-analyzer.md` - Added **IMPORTANT** banner
8. `system/hierarchy-validator.md` - Added **IMPORTANT** banner

## Impact

### Before
- Tools could analyze and flag work items that were already completed
- WIQL queries might return Done items, wasting analysis time
- Users could see recommendations for items that don't need attention

### After
✅ All queries automatically exclude Done/Completed/Closed/Resolved/Removed states  
✅ Tools focus only on active work items needing attention  
✅ Clear documentation guides users to skip finished work  
✅ Consistent behavior across all 18 prompts  

## Testing Recommendations

1. **Test WIQL queries** - Verify they don't return Done items
2. **Test each analysis tool** - Ensure they skip completed work items
3. **Check error messages** - Verify appropriate messages if only Done items match criteria
4. **Verify defaults** - Confirm hierarchy validator uses new default exclude_states

## Technical Notes

### States Excluded
The following state values are now excluded across all prompts:
- `Done`
- `Completed`
- `Closed`
- `Resolved`
- `Removed`

### WIQL Pattern
Standard pattern used throughout:
```wiql
AND [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed')
```

### Additional Context
Some organizations may use custom state names. If your organization uses different "finished" state names, you may need to:
1. Update the WIQL queries to include custom state names
2. Update the `exclude_states` default parameter in hierarchy_validator
3. Add notes about custom states in the prompt documentation

## Next Steps

1. ✅ **Changes committed** - All prompt updates saved
2. 🔄 **Testing needed** - Verify behavior with real work items
3. 📝 **User documentation** - May want to add to README or user guide
4. 🔍 **Monitor usage** - Watch for edge cases with custom state names

---

**Result:** All prompts now consistently exclude Done states, focusing AI analysis on active work items only.
