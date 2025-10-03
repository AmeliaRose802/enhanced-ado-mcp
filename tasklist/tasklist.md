- Add an intellegent tool for assigning story points to an item.

- The dead item query should not be doing repeated calls to get the last substantive change. Instead, it should be using the feature already in the wiql tool to get it in one call.

- See package response.md. Don't include assocated items in a removed or done state since they aren't very useful
    - Make this response as minimal and useful as you can

- Clean up the codebase and make it more AI ready. Don't break things. Improve the archetecture and reduce tech debt. There may be some unused files which should all be deleted

- Should not pop up browser to get token. No idea what is going on

- The prompt for enhacing a work item still asks for way too much stuff
    - Also doesn't actually update work item's description. Make sure it has tools to do so listed

- Review all prompts to remove marketing fluff etc and make them as tight and focused as possible. They should all output links in a valid format. None should look at done or removed items except the velocity one. Generally make them clean, logical and bulletproof. Don't break the WIQL queries.

- Context info in the ai assignement prompt not getting auto filled. The server should look up the work item ID and auto fill the data

- The first few attempts at kql queries by the velocity analysis prompt did not work:

{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway' AND [System.ChangedDate] >= @Today - 90 ORDER BY [System.ChangedDate] DESC",
  "includeFields": [
    "System.Title",
    "System.State",
    "System.WorkItemType",
    "System.AssignedTo",
    "System.CreatedDate",
    "System.ChangedDate",
    "Microsoft.VSTS.Scheduling.StoryPoints",
    "Microsoft.VSTS.Common.Priority",
    "System.Tags",
    "System.Description"
  ],
  "maxResults": 500
}

Make sure it is prompted with correct kql so that it will work. 

{
  "success": false,
  "data": null,
  "metadata": {
    "source": "rest-api-wiql"
  },
  "errors": [
    "Failed to execute WIQL query: Unexpected end of JSON input"
  ],
  "warnings": []
}

- May want to add a tool or example queries for getting work items by person. Would make it easier to analyze

- We have a very bad error where the AI sometimes halucinates item id's to remove