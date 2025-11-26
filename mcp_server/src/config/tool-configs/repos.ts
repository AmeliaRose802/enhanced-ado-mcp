import type { ToolConfig } from "../../types/index.js";
import { getPullRequestDiffSchema, getPullRequestCommentsSchema } from "../schemas.js";

/**
 * Repository Tools
 * Tools for Azure DevOps Git repository operations
 */
export const reposTools: ToolConfig[] = [
  {
    name: "get-pr-diff",
    description: "📄 PULL REQUEST DIFF: Fetch the complete diff for a pull request with actual code changes. Returns file-by-file unified diffs showing additions, deletions, and modifications by default (set includeDiffs=false for just file list). Supports side-by-side format, path filtering, and pagination. Essential for AI-powered code review workflows and understanding what changed in a PR.",
    script: "",
    schema: getPullRequestDiffSchema,
    inputSchema: {
      type: "object",
      properties: {
        repository: {
          type: "string",
          description: "Repository name or ID containing the pull request"
        },
        pullRequestId: {
          type: "number",
          description: "Pull request ID to fetch diff for"
        },
        iterationId: {
          type: "number",
          description: "Optional: Specific iteration ID to fetch. If not provided, fetches the latest iteration's diff"
        },
        includeContentMetadata: {
          type: "boolean",
          description: "Include additional file metadata (default: false)"
        },
        includeDiffs: {
          type: "boolean",
          description: "Include actual file diffs for each changed file (default: true). Set to false for just file list."
        },
        diffFormat: {
          type: "string",
          enum: ["unified", "sideBySide"],
          description: "Diff format: 'unified' for standard unified diff, 'sideBySide' for side-by-side comparison (default: unified)"
        },
        contextLines: {
          type: "number",
          description: "Number of context lines around changes in unified diff (default: 3, max: 20)"
        },
        maxDiffLines: {
          type: "number",
          description: "Maximum total diff lines to include per file (default: 1000, max: 10000). Files exceeding this show truncation warning."
        },
        pathFilter: {
          type: "array",
          items: { type: "string" },
          description: "Only include diffs for files matching these path patterns (glob-style, e.g., ['src/**/*.ts', 'tests/**'])"
        },
        top: {
          type: "number",
          description: "Maximum number of changed files to return (default: 100, max: 1000)"
        },
        skip: {
          type: "number",
          description: "Number of changed files to skip for pagination (default: 0)"
        },
        organization: {
          type: "string",
          description: "Azure DevOps organization name"
        },
        project: {
          type: "string",
          description: "Azure DevOps project name"
        }
      },
      required: ["repository", "pullRequestId"]
    }
  },
  {
    name: "get-pr-comments",
    description: "💬 AI-POWERED PR COMMENTS: Fetch and filter pull request discussion threads and comments using natural language or explicit criteria. Supports intelligent filtering by PR status (active/completed/abandoned), thread status (active/resolved/closed), dates, branches, and reviewers. Perfect for finding unresolved feedback, tracking review conversations, or analyzing discussion patterns. Modes: (1) Natural language: 'show active threads from PRs targeting main this week', (2) Specific PR: provide pullRequestId, (3) Search: use explicit filters like status, branches, dates.",
    script: "",
    schema: getPullRequestCommentsSchema,
    inputSchema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Natural language description of what PRs and comments to find (AI-powered). Example: 'Show active threads from PRs targeting main in the last week'"
        },
        repository: {
          type: "string",
          description: "Repository name or ID (required for specific PR, optional for search mode)"
        },
        pullRequestId: {
          type: "number",
          description: "Specific PR ID to fetch comments from (optional - omit to search for PRs)"
        },
        status: {
          type: "string",
          enum: ["active", "abandoned", "completed", "notSet", "all"],
          description: "PR status filter for search mode (default: active)"
        },
        creatorId: {
          type: "string",
          description: "Filter PRs by creator GUID (search mode only)"
        },
        reviewerId: {
          type: "string",
          description: "Filter PRs by reviewer GUID (search mode only)"
        },
        sourceRefName: {
          type: "string",
          description: "Filter PRs by source branch (e.g., 'refs/heads/feature/my-branch')"
        },
        targetRefName: {
          type: "string",
          description: "Filter PRs by target branch (e.g., 'refs/heads/main')"
        },
        minTime: {
          type: "string",
          description: "Filter PRs created after this date (ISO format YYYY-MM-DDTHH:mm:ssZ)"
        },
        maxTime: {
          type: "string",
          description: "Filter PRs created before this date (ISO format YYYY-MM-DDTHH:mm:ssZ)"
        },
        threadStatusFilter: {
          type: "array",
          items: {
            type: "string",
            enum: ["unknown", "active", "fixed", "wontFix", "closed", "byDesign", "pending"]
          },
          description: "Filter threads by status (e.g., ['active', 'pending'] for unresolved threads)"
        },
        includeSystemComments: {
          type: "boolean",
          description: "Include system-generated comments (default: false)"
        },
        includeDeleted: {
          type: "boolean",
          description: "Include deleted threads (default: false)"
        },
        maxPRsToFetch: {
          type: "number",
          description: "Maximum PRs to fetch in search mode (default: 10, max: 100)"
        },
        top: {
          type: "number",
          description: "Maximum PRs per page for search (default: 50)"
        },
        skip: {
          type: "number",
          description: "Number of PRs to skip for pagination (default: 0)"
        },
        organization: {
          type: "string",
          description: "Azure DevOps organization name"
        },
        project: {
          type: "string",
          description: "Azure DevOps project name"
        }
      },
      required: []
    }
  }
];
