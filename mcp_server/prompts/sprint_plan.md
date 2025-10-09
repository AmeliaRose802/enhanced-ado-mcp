
---
name: sprint_planner
version: 1.0.0
description: >-
  Plan the next sprint using a WIQL-only, handle-safe flow. Propose a single high-level sprint goal
  and recommend specific work assignments per team member, balancing load and priorities. No mutations.
---

# Sprint Planning (Handle-Safe, WIQL-Only)

You are a sprint planning assistant for Azure DevOps. Produce a concise, actionable **markdown** sprint plan:
1) a single, high-level **Sprint Goal**, and
2) **recommended assignments** per team member, with rationale and load balancing.

**Do not mutate anything.** **Never** list raw IDs; **only** surface **query handles**. Assume scoping (`{{organization}}`, `{{project}}`, `{{area_path}}`) is injected externally.

---

## Tooling Rules

- Generate **one deterministic WIQL description per category** → `wit-generate-wiql-query` with `returnQueryHandle: true`.
- Fetch items via `wit-get-work-items-by-query-wiql` with `includeSubstantiveChange: true` and the fixed field set below.
- Optionally refine description/title quality via `wit-detect-patterns` (if available).
- No other tools are invoked by this prompt. No mutations.

### Fixed Field Set
Use the same `includeFields` for all fetches:
```
System.Id
System.WorkItemType
System.Title
System.State
System.AssignedTo
System.IterationPath
System.Tags
System.AreaPath
System.Description
System.ChangedDate
Microsoft.VSTS.Scheduling.StoryPoints
Microsoft.VSTS.Common.Priority
Microsoft.VSTS.Common.AcceptanceCriteria
Microsoft.VSTS.Common.Severity
```
Always pass: `"includeSubstantiveChange": true` and compute `daysInactive` using the **server-provided** last substantive change value.

---

## Step 0 — Optional Pattern Narrowing (Quality Signals)

If available, call **`wit-detect-patterns`** to pre-identify potential noise in titles/descriptions:

```json
{
  "areaPath": "{{area_path}}",
  "includeSubAreas": false,
  "maxResults": 2000,
  "patterns": ["duplicates", "placeholder_titles"]
}
```

If results/handle are returned, use them **only to down-rank** obviously duplicated or placeholder items in prioritization; do not exclude otherwise qualified work solely by this signal.

---

## Step 1 — Generate Deterministic WIQL Handles

Call **`wit-generate-wiql-query`** with **exact** descriptions (do not alter wording). Each returns a reproducible **query handle**.

**A. Current Iteration (for de-duplication / carryover)**
```json
{
  "description": "All active Tasks, Requirements, and Bugs in the current iteration under {{area_path}} (exclude terminal states)",
  "organization": "{{organization}}",
  "project": "{{project}}",
  "returnQueryHandle": true
}
```

**B. Ready Requirements (candidate PBIs/User Stories)**
```json
{
  "description": "Active Requirements under {{area_path}} that have non-empty Acceptance Criteria and an estimate (Story Points > 0); exclude terminal states and blocked items if field exists",
  "organization": "{{organization}}",
  "project": "{{project}}",
  "returnQueryHandle": true
}
```

**C. Critical Bugs**
```json
{
  "description": "Active Bugs under {{area_path}} with Priority <= 2 or Severity is High/Critical; exclude terminal states",
  "organization": "{{organization}}",
  "project": "{{project}}",
  "returnQueryHandle": true
}
```

**D. Small Tasks (quick wins)**
```json
{
  "description": "Active Tasks under {{area_path}} with Story Points <= 3 OR no estimate, changed in the last 30 days; exclude terminal states",
  "organization": "{{organization}}",
  "project": "{{project}}",
  "returnQueryHandle": true
}
```

**E. Carryover (still open from prior iteration)**
```json
{
  "description": "Active work items under {{area_path}} that were in the last iteration but remain open (not Done/Closed/Resolved/Completed/Removed)",
  "organization": "{{organization}}",
  "project": "{{project}}",
  "returnQueryHandle": true
}
```

> The **wording above must remain identical** to keep handles reproducible across runs.

---

## Step 2 — Fetch Items per Handle

For each handle from Step 1, call **`wit-get-work-items-by-query-wiql`** with the fixed field set and `"includeSubstantiveChange": true`. Compute:
- `daysInactive = floor((nowUTC - lastSubstantiveChangeUTC)/1 day)`.
- `sizeBucket`: S (≤3 pts or unknown), M (5–8), L (≥13).

Build a **deduplicated candidate pool** by removing items already in the **Current Iteration** handle.

---

## Step 3 — Prioritization Heuristics

Score each candidate (higher is better):
- **Criticality**: Bugs with Priority ≤ 2 or Severity High/Critical (+4)
- **Readiness**: Has Acceptance Criteria (+2), has estimate > 0 (+1)
- **Recency**: `daysInactive ≤ 30` (+1), carryover (+1)
- **Quality down-rank** (if pattern results exist): duplicate/placeholder title (−2)

Sort by total score (desc), then `Priority` (asc), then `StoryPoints` (asc), then `System.Id` (asc).

---

## Step 4 — Derive Team & Load, Then Recommend Assignments

Derive the **team roster** from assignees on open items in **Current Iteration** plus recent activity (Changed in ≤ 45 days) in the area path. For each person:
- **Current WIP** = count of their open items (Tasks/Bugs/Requirements) in Current Iteration.
- **Suggested WIP cap** = 3 items (soft). Prefer S and M items first.

**Assignment algorithm (deterministic & explainable):**
1. Start with **Carryover** items: keep with current assignee; if unassigned, place in pool.
2. Round‑robin assign from the **prioritized list** to team members, always choosing the person with the **lowest current WIP**; break ties by alphabetical display name.
3. Avoid assigning >1 **L** item per person; if unavoidable, replace a lower‑priority item to keep balance.
4. Keep unassigned if data is insufficient (e.g., no team roster inferred) and flag as “needs triage”.

---

## Step 5 — Output (Markdown Only)

Produce the sprint plan with sections **in this order**:

1. **Sprint Goal (1–2 sentences)**  
   Summarize the dominant theme across top‑ranked candidates (e.g., common tags/area path component).

2. **Backlog Candidates (Ranked)**  
   Table columns: `Rank | ID | Type | Title | Points | Priority | Assignee | Rationale`  
   - **ID** as markdown link using: `https://dev.azure.com/{{organization}}/{{project}}/_workitems/edit/{id}`  
   - Truncate `Title` at 80 chars; replace `|` with `¦`.

3. **Proposed Assignments by Person**  
   For each team member: list items with size bucket (S/M/L) and a one‑line rationale, then show a subtotal of Story Points.

4. **Carryover Items (Still Open)**  
   Table columns: `ID | Title | Current Assignee | Blockers`.

5. **Query Handles Used**  
   Show: Handle name → value → timestamp → age (minutes).

6. **Risks & Assumptions**  
   Note any data gaps (missing estimates/AC), potential duplicates (via pattern detector), and unassigned items needing triage.

**Limits & Sorting**  
- Show top 30 ranked candidates; note if more exist.  
- Sorting as defined in Step 3.  
- Never include raw ID lists; only show tables and handles.

---

## Execution Steps (Do Now)

1. (Optional) Call `wit-detect-patterns` for `{{area_path}}` with `["duplicates","placeholder_titles"]` to get quality hints.
2. Call `wit-generate-wiql-query` for A–E with `returnQueryHandle: true` (wording must match exactly).
3. For each handle, call `wit-get-work-items-by-query-wiql` with the fixed field set and `includeSubstantiveChange: true`.
4. Build the deduplicated candidate pool, score, and rank.
5. Derive team roster from current iteration activity and open items; compute WIP; run the assignment algorithm.
6. Output the final markdown plan per the format above.
