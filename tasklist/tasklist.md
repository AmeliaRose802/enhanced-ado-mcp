Still broken:

{
  "success": false,
  "data": null,
  "metadata": {
    "source": "sprint-planning-analysis-failed",
    "samplingAvailable": true,
    "errorCategory": "not-found",
    "errorMetadata": {
      "category": "not-found",
      "context": {
        "source": "sprint-planning-analysis-failed"
      },
      "timestamp": "2025-11-08T01:30:12.719Z",
      "retryable": false
    }
  },
  "errors": [
    "Sprint planning analysis failed: Error: Failed to fetch active work items:\n  Organization: \"msazure\"\n  Project: \"One\"\n  Error: ADOHttpError: HTTP 404: Not Found\n\nTroubleshooting:\n  1. Verify the project name is correct (check Azure DevOps portal)\n  2. Ensure you have access to this project\n  3. Try running 'az devops project show --project \"One\" --org \"https://dev.azure.com/msazure\"'\n  4. If project name has spaces or special characters, ensure proper escaping in area path"
  ],
  "warnings": []
}