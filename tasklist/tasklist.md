All of our prompts seem quite convinced we have no story points on any items at all but we do have estimationon some items

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

Story point analysis tool reporting no story points for item that does have story points:
{
  "success": true,
  "data": {
    "query_handle": "qh_e9f01eb8730d02ef66c5982bef4056fa",
    "item_count": 1,
    "original_query": "SELECT [System.Id] FROM WorkItems WHERE [System.Id] = 35655356",
    "analysis_types": [
      "effort"
    ],
    "results": {
      "effort": {
        "total_items": 1,
        "items_with_story_points": 0,
        "items_without_story_points": 1,
        "total_story_points": 0,
        "average_story_points": 0,
        "type_distribution": {
          "Product Backlog Item": {
            "count": 1,
            "storyPoints": 0
          }
        },
        "estimation_coverage": 0
      }
    }
  },
  "metadata": {
    "source": "analyze-by-query-handle"
  },
  "errors": [],
  "warnings": []
}


{
  "success": true,
  "data": {
    "contextPackage": {
      "id": 35655356,
      "title": "Design document for CVM integrity protection via IMDS",
      "type": "Product Backlog Item",
      "state": "Done",
      "areaPath": "One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway",
      "iterationPath": "One\\Krypton",
      "assignedTo": "Supriya Kumari",
      "createdDate": "2025-10-21T16:24:43.013Z",
      "createdBy": "Hemendra Rawat",
      "changedDate": "2025-11-08T00:02:42.65Z",
      "changedBy": "Hemendra Rawat",
      "priority": 2,
      "tags": [],
      "url": "https://dev.azure.com/msazure/One/_workitems/edit/35655356",
      "parent": {
        "id": 35655336,
        "title": "IMDS CVM support for digitally signing compute metadata",
        "type": "Feature",
        "state": "New"
      },
      "children": [],
      "related": [
        {
          "type": "System.LinkTypes.Related",
          "id": 35851457,
          "title": "Cloned: CVM integrity protection design - Modified",
          "state": "New"
        }
      ],
      "pullRequests": [],
      "commits": [],
      "comments": [],
      "_raw": {
        "fields": {
          "System.Id": 35655356,
          "System.AreaPath": "One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway",
          "System.TeamProject": "One",
          "System.AreaLevel1": "One",
          "System.AreaLevel2": "Azure Compute",
          "System.AreaLevel3": "OneFleet Node",
          "System.AreaLevel4": "Azure Host Agent",
          "System.AreaLevel5": "Azure Host Gateway",
          "System.IterationId": 369304,
          "System.IterationPath": "One\\Krypton",
          "System.IterationLevel1": "One",
          "System.IterationLevel2": "Krypton",
          "System.WorkItemType": "Product Backlog Item",
          "System.State": "Done",
          "System.Reason": "Moved out of state In Review",
          "System.AssignedTo": "Supriya Kumari",
          "System.CreatedDate": "2025-10-21T16:24:43.013Z",
          "System.CreatedBy": "Hemendra Rawat",
          "System.ChangedDate": "2025-11-08T00:02:42.65Z",
          "System.ChangedBy": "Hemendra Rawat",
          "System.Title": "Design document for CVM integrity protection via IMDS",
          "System.BoardColumn": "Done",
          "Microsoft.VSTS.Common.ClosedDate": "2025-11-08T00:02:42.65Z",
          "Microsoft.VSTS.Scheduling.Effort": 5,
          "Microsoft.VSTS.Common.ClosedBy": "Hemendra Rawat",
          "Microsoft.VSTS.Common.ActivatedDate": "2025-10-21T16:25:58.827Z",
          "Microsoft.VSTS.Common.ActivatedBy": "Hemendra Rawat",
          "Microsoft.VSTS.Common.Priority": 2,
          "Microsoft.VSTS.Common.ValueArea": "Business",
          "Scrum_custom.IsException": false,
          "Scrum_custom.OriginalRiskRating": "High",
          "Scrum_custom.AdjustedRiskRating": "High",
          "System.History": "<div>Transfer of knowledge done to Mayank Daruka. He has everything he needs to pick up the work </div>",
          "Microsoft.VSTS.Common.Resolution": "<a href=\"https://azurewiki.cloudapp.net/Requesting%20an%20Exception\">Requesting exception</a>",
          "System.Parent": 35655336
        }
      }
    }
  },
  "metadata": {
    "source": "get-work-item-context-package",
    "samplingAvailable": true
  },
  "errors": [],
  "warnings": []
}

Fix:

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
      "timestamp": "2025-11-08T01:48:33.689Z",
      "retryable": false
    }
  },
  "errors": [
    "Sprint planning analysis failed: Error: Failed to fetch active work items:\n  Organization: \"msazure\"\n  Project: \"One\"\n  Error: ADOHttpError: HTTP 404: Not Found\n\nTroubleshooting:\n  1. Verify the project name is correct (check Azure DevOps portal)\n  2. Ensure you have access to this project\n  3. Try running 'az devops project show --project \"One\" --org \"https://dev.azure.com/msazure\"'\n  4. If project name has spaces or special characters, ensure proper escaping in area path"
  ],
  "warnings": []
}


Why did this return only 8 items?
{
  "handleOnly": true,
  "returnQueryHandle": true,
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway' AND [System.State] NOT IN ('Done', 'Removed', 'Closed', 'Completed', 'Resolved')"
}
{
  "success": true,
  "data": {
    "query_handle": "qh_581d77ea5e4207905f912cd9f0d8aa4f",
    "work_item_count": 8,
    "total_count": 8,
    "query": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway' AND [System.State] NOT IN ('Done', 'Removed', 'Closed', 'Completed', 'Resolved')",
    "summary": "Query handle created for 8 work item(s). Handle-only mode: work item details not fetched for efficiency. Use the handle with bulk operation tools or wit-query-handle-get-items to retrieve items. Handle expires in 1 hour.",
    "next_steps": [
      "Use wit-query-handle-get-items to retrieve work item details if needed",
      "Use wit-bulk-comment to add comments to all items",
      "Use wit-bulk-update to update fields on all items",
      "Use wit-bulk-assign to assign all items to a user",
      "Use wit-bulk-remove to remove all items",
      "Always use dryRun: true first to preview changes before applying them"
    ],
    "expires_at": "2025-11-11T00:50:38.917Z"
  },
  "metadata": {
    "source": "rest-api-wiql",
    "queryHandleMode": true,
    "handleOnlyMode": true,
    "handle": "qh_581d77ea5e4207905f912cd9f0d8aa4f",
    "count": 8,
    "totalCount": 8
  },
  "errors": [],
  "warnings": []
}