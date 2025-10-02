# Azure Host Gateway Backlog Hygiene Report
**Date:** October 1, 2025  
**Area Path:** One\Azure Compute\OneFleet Node\Azure Host Agent\Azure Host Gateway  
**Organization:** msazure  
**Project:** One  
**Max Inactive Days:** 180

---

## Summary

**Analysis Parameters:**
- Total Active Work Items Analyzed: 69 (excludes Done/Completed/Closed/Resolved)
- Max Inactive Days Threshold: 180 days
- At-Risk Threshold: 135 days (75% of max)
- Minimum Description Length: 50 characters

**Results:**
- **Dead Candidates:** 15 items
- **At Risk:** 26 items  
- **Healthy:** 28 items

**Key Findings:**
- ~22% of active work items show signs of abandonment (dead candidates)
- ~38% of active work items are approaching staleness (at-risk)
- Multiple compliance tasks from 2023 remain untouched
- Several features from 2021-2022 have minimal/no descriptions and no recent activity

---

## Dead Candidates

These items show strong signals of abandonment and should be triaged for closure, archival, or revival.

| ID | Title | Type | State | DaysInactive | AssignedTo | ReasonSignals |
|----|-------|------|-------|--------------|------------|---------------|
| 5816697 | Move the dsms entries from AzLinux to IMDS service tree | Task | To Do | 176 | Unassigned | Changed 176 days ago, Created 2089 days ago, In passive state (To Do) |
| 12476027 | Add latched Key | Task | To Do | 176 | Unassigned | Changed 176 days ago, Created 1434 days ago, In passive state (To Do) |
| 13438317 | Create TSG | Task | To Do | 176 | Joshua McCarthy | Changed 176 days ago, No description, Created 1321 days ago, In passive state (To Do) |
| 14184101 | Support config file copy | Task | To Do | 176 | Wei Lim | Changed 176 days ago, No description, Created 1259 days ago, In passive state (To Do) |
| 15847418 | Future Work | Feature | New | 176 | Unassigned | Changed 176 days ago, No description, In passive state (New) |
| 15999720 | Compliance Asks | Feature | Committed | 176 | Unassigned | Changed 176 days ago, Created 1067 days ago |
| 16064870 | Fill out servicing section | Task | To Do | 176 | Ben Xia-Reinert | Changed 176 days ago, No description, Created 1061 days ago, In passive state (To Do) |
| 16871962 | Ensure Language Availability | Task | To Do | 54 | Unassigned | Created 983 days ago, In passive state (To Do), 1CS compliance task from 2023 |
| 16871963 | Ensure Product is Localizable | Task | To Do | 54 | Unassigned | Created 983 days ago, In passive state (To Do), 1CS compliance task from 2023 |
| 16871964 | Ensure Compliance with National Language Laws | Task | To Do | 54 | Unassigned | Created 983 days ago, In passive state (To Do), 1CS compliance task from 2023 |
| 16871966 | Call Regional Formats Correctly | Task | To Do | 54 | Unassigned | Created 983 days ago, In passive state (To Do), 1CS compliance task from 2023 |
| 16871967 | Review Country and Region Names | Task | To Do | 54 | Unassigned | Created 983 days ago, In passive state (To Do), 1CS compliance task from 2023 |
| 16871968 | Review Maps and Cartographic Content | Task | To Do | 54 | Unassigned | Created 983 days ago, In passive state (To Do), 1CS compliance task from 2023 |
| 16871969 | Review New Product, Feature and Service Names | Task | To Do | 54 | Unassigned | Created 983 days ago, In passive state (To Do), 1CS compliance task from 2023 |
| 31704884 | Out of tree parented asks | Epic | New | 176 | Unassigned | Changed 176 days ago, Created 208 days ago, In passive state (New), Minimal description |

---

## At Risk

These items are approaching the staleness threshold and need attention within the next 45 days.

| ID | Title | Type | State | DaysInactive | AssignedTo | ReasonSignals |
|----|-------|------|-------|--------------|------------|---------------|
| 12476140 | AHG-O MVP M3: Deployment to OVL Prod regions | Epic | New | 148 | Hemendra Rawat | Changed 148 days ago, Created 1433 days ago, In passive state (New) |
| 14308600 | Long Term- Infrastructure efficiency (including Overlake) | Key Result | Committed | 148 | Supriya Kumari | Changed 148 days ago, Created 1248 days ago |
| 31706727 | Max VM Support for IMDS | Epic | New | 175 | Unassigned | Changed 175 days ago, No description, Created 208 days ago, In passive state (New) |
| 31706787 | Enhanced Live Migrate Support | Epic | New | 175 | Unassigned | Changed 175 days ago, No description, Created 208 days ago, In passive state (New) |
| 31778500 | [AHG-O] IMDS endpoint Load test. | Product Backlog Item | New | 176 | Unassigned | Changed 176 days ago, Created 203 days ago, In passive state (New) |
| 31703920 | IMDS Certs Service Tree Removal | Feature | New | 54 | Supriya Kumari | Changed 54 days ago, No description, Created 208 days ago, In passive state (New) |
| 31706632 | All S360 / TSA / etc (automated tickets) | Epic | New | 54 | Unassigned | Changed 54 days ago, No description, Created 208 days ago, In passive state (New) |
| 31753539 | Migration prep | Feature | New | 62 | Unassigned | Changed 62 days ago, No description, Created 204 days ago, In passive state (New) |
| 31753670 | Burn down existing clients | Feature | New | 62 | Unassigned | Changed 62 days ago, Created 204 days ago, In passive state (New) |
| 31753727 | AHG-W Migrate port 8889 | Feature | New | 62 | Unassigned | Changed 62 days ago, Created 204 days ago, In passive state (New) |
| 31753766 | Migrate Simple IMDS endpoints | Feature | New | 62 | Unassigned | Changed 62 days ago, No description, Created 204 days ago, In passive state (New) |
| 31753770 | Migrate MSI | Feature | New | 62 | Unassigned | Changed 62 days ago, No description, Created 204 days ago, In passive state (New) |
| 31753774 | Migrate Instance Endpoint | Feature | New | 62 | Unassigned | Changed 62 days ago, No description, Created 204 days ago, In passive state (New) |
| 31853246 | Albus anomaly detection for HostGateway | Feature | New | 62 | Trinh Mai | Changed 62 days ago, No description, Created 197 days ago, In passive state (New) |
| 32082179 | Pre Launch checks | Feature | New | 62 | Unassigned | Changed 62 days ago, No description, Created 183 days ago, In passive state (New) |
| 32713670 | BareMetal Provisioning workflow design in AHG | Feature | New | 62 | Satyanarayana Chivukula | Changed 62 days ago, Created 149 days ago, In passive state (New) |
| 32713698 | BareMetal IMDS Data | Feature | New | 62 | Satyanarayana Chivukula | Changed 62 days ago, Created 149 days ago, In passive state (New), Minimal description |
| 32713701 | Support for L2 VM Migration via Azure HostGateway | Feature | New | 62 | Satyanarayana Chivukula | Changed 62 days ago, Created 149 days ago, In passive state (New) |
| 32784080 | NMAgent's listener on <Physical IPv4>:6666 needs HTTPS and AuthN - Partner Ask - WireServer | Feature | New | 62 | Supriya Kumari | Changed 62 days ago, Created 147 days ago, In passive state (New) |
| 33248138 | Upgrade to newer crypto requirements | Feature | Committed | 62 | Unassigned | Changed 62 days ago, Created 112 days ago |
| 33249234 | Upgrade to compliant crypto crate | Feature | Committed | 62 | Unassigned | Changed 62 days ago, Created 112 days ago |
| 33491092 | Avoid iterating over all request/response bytes in AHG-O Sideways Server | Product Backlog Item | New | 93 | Unassigned | Changed 93 days ago, No description, Created 99 days ago, In passive state (New) |
| 33857793 | [Tracking Item] : NMagent asks for gRPC endpoints for IMDS for OVL/BM | Feature | New | 62 | Minnie Lahoti | Changed 62 days ago, No description, Created 75 days ago, In passive state (New) |
| 33879005 | Exotic Sku Cirrus Coverage | Feature | New | 62 | Unassigned | Changed 62 days ago, Created 72 days ago, In passive state (New) |
| 33896834 | Culture Conversation Work Items | Feature | New | 62 | Supriya Kumari | Changed 62 days ago, No description, Created 71 days ago, In passive state (New) |
| 34346654 | Forgotten live site (DON'T ADD NEW ONES) | Feature | New | 54 | Unassigned | Changed 54 days ago, No description, Created 54 days ago, In passive state (New), Title suggests archived/deprecated |

---

## Recommendations

### Immediate Actions (Dead Candidates - 15 items)

1. **Close or Archive Compliance Tasks (7 items: 16871962-16871969)**
   - These 1CS compliance tasks were filed in Jan 2023 and remain unassigned
   - **Action:** Evaluate if these compliance requirements apply to your service. If yes, assign and schedule. If no, close with justification.
   - **Impact:** Reduces backlog by 7 items

2. **Resolve or Delete Old Infrastructure Tasks (5 items: 5816697, 12476027, 13438317, 14184101, 16064870)**
   - These tasks are 3-5 years old with no recent activity
   - **Action:** Review with original stakeholders. If still relevant, add context and schedule. Otherwise, close as obsolete.
   - **Impact:** Removes technical debt from 2019-2022

3. **Clarify "Future Work" Feature (15847418)**
   - Generic title with no description
   - **Action:** Either break down into concrete items or delete as placeholder

4. **Review Compliance Feature (15999720)**
   - Overlake security strategy item from 2022 with Jan 2024 deadline
   - **Action:** Verify if completed but not closed, or close as obsolete

5. **Address "Out of tree parented asks" Epic (31704884)**
   - Vague linker epic with minimal description
   - **Action:** Clarify purpose or delete

### Short-Term Actions (At-Risk - 26 items, prioritize top 10)

1. **IMDS Migration Features (7 items: 31753539, 31753670, 31753727, 31753766, 31753770, 31753774)**
   - Migration-related features with minimal descriptions created ~7 months ago
   - **Action:** If migration is active initiative, add acceptance criteria and roadmap timeline. If not, defer to later iteration.

2. **Epic Placeholders (3 items: 31706727, 31706787, 12476140)**
   - Epics with no or minimal descriptions
   - **Action:** Add scope, child items, or close if no longer relevant

3. **BareMetal Features (3 items: 32713670, 32713698, 32713701)**
   - Recent features (5 months) but approaching staleness
   - **Action:** If BareMetal is priority, add detailed requirements and schedule sprints

4. **Security/Compliance Partner Asks (32784080, 33857793)**
   - Partner-driven security requirements
   - **Action:** Prioritize security items - schedule design reviews and implementation

### Process Improvements

1. **Work Item Hygiene Policy:**
   - Require minimum description length (100+ chars) with acceptance criteria
   - Auto-flag items in "New/To Do" state for 90+ days
   - Monthly backlog grooming for items 120+ days inactive

2. **Ownership Discipline:**
   - 15 items are unassigned - assign owners or close
   - Assign "DRI" field for accountability

3. **Epic/Feature Decomposition:**
   - Many epics/features lack child items - break down into actionable tasks
   - Use acceptance criteria to define "done"

4. **Stale Item Review:**
   - Schedule quarterly review of items 90+ days old
   - Decision: Keep & schedule, defer to backlog, or close

---

## Healthy Items (Sample - 28 total)

These items have recent activity or are actively being worked:

- **34510673-34510737:** Recent tasks created Aug 20, 2025 (AI/Copilot demos)
- **34401434:** In Review state, recently updated Aug 12, 2025 (Streaming support)
- **32988485:** Approved PBI, updated Jul 21, 2025 (VDPA feature flag)
- **31703757:** Committed feature with recent update Jul 31, 2025 (AzIMDS investigation)
- **14299831:** Key Result with activity Aug 19, 2025 (Maintain Quality)

---

## Appendix: Stale Item Criteria

Items flagged as **Dead** if one or more:
1. ChangedDate > 180 days
2. State in {New, Proposed, Backlog, To Do} AND age > 90 days
3. No description or description < 50 characters
4. No AssignedTo OR assigned but no change > 180 days
5. Title contains placeholder terms ("TBD", "foo", "test", "spike")

Items flagged as **At Risk** if:
- ChangedDate between 135-180 days
- In passive state (New/Backlog/To Do) for 70-90 days
- Assigned but minimal recent activity

---

**Report Generated:** October 1, 2025  
**Next Review Recommended:** January 1, 2026 (Quarterly)
