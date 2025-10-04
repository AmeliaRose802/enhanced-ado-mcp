Notes on prompts

Ai fit analysis
- It should be injecting the work items data into the prompt so additional calls aren't needed but it isn't doing so

backlog cleanup
- Remove  (defaults to configured area path), (default: 180),(Auto-Populated) etc. Not valuable
```
- `wit-get-work-items-context-batch` – ⚠️ batch enrichment (LIMIT: 20-30 items per call to avoid context overflow)
- `wit-get-work-item-context-package` – ⚠️ deep dive for edge cases (use sparingly, returns large payload)
```
- Sus

Should not list tools not used:

(Create/assign tools available but not used for removal analysis): `wit-create-new-item`, `wit-assign-to-copilot`, `wit-new-copilot-item`, `wit-extract-security-links`

Might need to add a tool specifically for finding items with missing fields:

```
**Missing Acceptance Criteria** (User Stories/PBIs only):

**IMPORTANT: Microsoft.VSTS.Common.AcceptanceCriteria is a long-text field and cannot be queried with equality operators in WIQL.**

Instead, retrieve User Stories/PBIs first, then check acceptance criteria using `wit-get-work-items-context-batch`:
```

