- ✅ The backlog cleanup flow includes tools that do not exist
   - ✅ Audit all prompts to make sure tools and queries referenced still exist
   - Fixed: backlog_cleanup.md, sprint_plan.md, team_velocity_analyzer.md (15+ tool references corrected)

- ✅ Extract the project name from the area path. We should not require providing both

- ✅ Provide example area path and org during setup
   - Added examples to all configuration error messages in config.ts

- ✅ During the backlog cleanup flow, specify that the look back period param must be a number of days not an arbitrary string
   - Updated backlog_cleanup.md: staleness_threshold_days now explicitly states "Number of days"

- ✅ Undo tool needs to allow undoing more than the most recent action. It should allow undoing all actions performed on the query handle
   - Added undoAll parameter to wit-bulk-undo-by-query-handle (default: false for backward compatibility)
   - Operations undone in reverse chronological order

- ✅ Add a prompt for sprint review. It should look at last n days (ask user how long) and review if planned work was completed. It should identify bottlenecks and opportunities.
   - Created sprint_review.md with lookback_days parameter, completion analysis, bottleneck identification

- ✅ Write a plan for supporting more than one area path
   - Created comprehensive feature spec: docs/feature_specs/multi-area-path-support.md
   - Covers configuration, tool changes, implementation approach, migration path
 