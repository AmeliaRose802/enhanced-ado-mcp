- We have a very bad bug where the AI sometimes halucinates item id's to remove. See the halucination_fix_proposal.md

- Add an intellegent tool for assigning story points to an item.

- Check all prompts and exposed resources and make sure they are updated for pagnation awareness

- All queries in prompts and resources need to be actually run in order to make sure they work. We should not include false and broken queries.

- Filter out "@odata.id": null, from odata responses since it uses context window without providing value.

- When I enter a diffrent number of days to look back in the team velocity prompt, I still get the same thing entered.


- Seems to be some kind of token timeout with the odata tools. After some time they start persistently returning 401s until I restart the server. Make sure to reset these when needed.

- ✅ **FIXED** - The cycle time metrics type of the odata tool now works correctly:
  - Fixed: Conditional ordering based on `computeCycleTime` flag
  - Fixed: Added `CompletedCount` to aggregation when computing cycle time
  - Fixed: Proper `$orderby` clause that doesn't reference non-existent fields
  - See: `docs/ODATA_QUERY_OPTIMIZATION.md` for details

~~Old error (now fixed):~~
```json
{
  "success": false,
  "data": null,
  "metadata": {
    "source": "odata-analytics"
  },
  "errors": [
    "Analytics API error: 400 Bad Request - {\"error\":{\"code\":\"0\",\"message\":\"VS403483: The query specified in the URI is not valid: $apply/groupby grouping expression 'AvgCycleTime' must evaluate to a property access value..\",\"innererror\":{\"message\":\"$apply/groupby grouping expression 'AvgCycleTime' must evaluate to a property access value.\",\"type\":\"Microsoft.OData.ODataException\",\"stacktrace\":\"\"}}}"
  ],
  "warnings": []
}
```

- See package response.md. Don't include assocated items in a removed or done state since they aren't very useful
    - Make this response as minimal and useful as you can

- Clean up the codebase and make it more AI ready. Don't break things. Improve the archetecture and reduce tech debt. There may be some unused files which should all be deleted

- Should not pop up browser to get token. No idea what is going on

- The prompt for enhacing a work item still asks for way too much stuff
    - Also doesn't actually update work item's description. Make sure it has tools to do so listed

- Review all prompts to remove marketing fluff etc and make them as tight and focused as possible. They should all output links in a valid format. None should look at done or removed items except the velocity one. Generally make them clean, logical and bulletproof. Don't break the WIQL queries.

- Context info in the ai assignement prompt not getting auto filled. The server should look up the work item ID and auto fill the data

- Managing tech debt is important to the heathy continual devlopment. Please fix tech debt

- A number of our tests are currently failing making it harder to tell when we broke things. They should all be fixed.