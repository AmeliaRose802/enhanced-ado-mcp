✅ 1. **FIXED** - The odata tool 401 error has been resolved:

**ROOT CAUSE**: OData handler was constructing API URLs without validating organization/project parameters. When undefined (configuration issue), URLs contained literal "undefined" values causing TF400813 errors that appeared to be permissions issues.

**THE FIX**: Added parameter validation in all OData functions with clear error messages pointing to configuration issues.

**COMMIT**: 01aea7b - "fix: Add parameter validation to OData handler to prevent undefined org/project in URLs"

---

2. Add a tool to find aviable subagents in a given repo. The avaible subagents can be found under /.azuredevops/policies in any repo. 


They always start with:

```yml
# metadata
name: Copilot pair programmer, specialized agents
description: A component governance agent that adds CG specific tools and instructions
```

The tool should return a list of names and descriptions for avabile subagents.

3. Add a tool to get people on the team. 

4. The hyerchey analysis tool returns the same data 3 times over creating a lot of bloat and token wasteage. Just return the handles by default so the user can fetch data on demand.


5. The tools: wit-list-query-handles and wit-get-prompts are primarly used for debugging. Please feature flag so these are disabled in the released version


