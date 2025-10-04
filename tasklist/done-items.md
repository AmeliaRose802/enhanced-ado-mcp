- - ✅ **COMPLETED** - Implement pagination for wiql tool:
  - Added `skip` and `top` parameters to the WIQL schema
  - `top` parameter overrides `maxResults` when specified
  - Response includes pagination metadata with `totalCount`, `hasMore`, and `nextSkip` fields
  - Updated handler to provide clear pagination information in warnings
  - Added pagination test to wiql-query.test.ts
  - Updated documentation in README.md and wiql-quick-reference.md.

- ✅ **FIXED** - The `includeSubstantiveChange` feature in the WIQL tool now works reliably:
  - Fixed: Added batching (10 items at a time) instead of parallel processing all items at once
  - Fixed: Improved error handling - errors are now properly caught and reported instead of silently swallowed
  - Fixed: Added detailed logging for debugging (batch progress, success/error counts)
  - Fixed: Changed from warning to error logging when substantive change calculation fails
  - The feature makes N API calls (one per work item) which is by design - there's no batch API for revisions


- ✅ **FIXED** - MCP Resources not being exposed:
  - Root cause: Resources and prompts folders were not being copied to dist during build
  - Fixed: Updated package.json build script to copy resources and prompts folders to dist
  - Fixed: Corrected getResourcesDir() path logic in resource-service.ts (was using wrong path for dist)
  - Fixed: Added `name` field to resource content responses per MCP specification
  - Fixed: Replaced `__filename` and `__dirname` with ES module equivalents (`import.meta.url`) to fix runtime error
  - Result: Resources are now properly accessible via MCP protocol (resources/list and resources/read)
  - Version bumped to 1.4.1