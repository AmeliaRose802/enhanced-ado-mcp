# Personal Workload Analyzer - Quick Reference

## Purpose
Analyze an individual's work over a time period to identify:
- 🔴 **Burnout risk** - Excessive workload, long hours, lack of breaks
- 🔴 **Overspecialization** - Too narrow work scope, limited skill diversity
- 🟠 **Stagnation** - Repetitive low-complexity work without growth
- 🟡 **Work-life balance** - After-hours work patterns, continuous work
- 🟡 **Coding vs non-coding balance** - For developers, ensure sufficient dev time
- ✅ **Career growth opportunities** - Skill development, stretch assignments

## When to Use

### ✅ Good Use Cases
- Quarterly check-ins for workload balance
- Career development planning conversations
- Identifying skill development opportunities
- Proactive burnout prevention
- Promotion readiness assessment
- Skill diversification planning

### ❌ Not Appropriate For
- Performance reviews (too narrow a view)
- Compensation decisions (incomplete data)
- Disciplinary actions (indirect evidence only)
- Comparing team members competitively

## Basic Usage

### Standard Health Check
```json
{
  "assignedToEmail": "user@domain.com",
  "analysisPeriodDays": 90
}
```

Returns comprehensive analysis including:
- Overall health score (0-100)
- Risk flags (critical, concerning, minor)
- Work variety and specialization analysis
- Coding vs non-coding balance
- Growth trajectory assessment
- Actionable recommendations

### With Custom Intent
```json
{
  "assignedToEmail": "user@domain.com",
  "analysisPeriodDays": 180,
  "additionalIntent": "assess readiness for senior engineer promotion"
}
```

Additional analysis focuses on:
- Leadership activities
- Mentorship evidence
- Complex problem-solving
- Cross-functional collaboration
- Technical influence

## What It Analyzes

### Automatic Data Collection
The tool automatically fetches:
1. **Completed work** (OData) - Historical velocity, work types, patterns
2. **Active work** (WIQL) - Current load, WIP count, complexity
3. **Story Points** - Automatically estimates gaps for weighted load analysis
4. **Context samples** - Top 10-20 items for pattern detection

### Key Metrics
- **Velocity:** Story Points/week completed
- **Weighted Load:** Complexity-adjusted active work burden
- **WIP Status:** Concurrent task count (healthy: 2-4, critical: 7+)
- **Work Variety:** Distribution across Bug/Task/PBI/Feature/Epic
- **Coding %:** Proportion of development vs operational work
- **Complexity Trend:** Increasing, stable, or decreasing over time
- **Temporal Patterns:** After-hours work, continuous work without breaks

### Health Scoring Rubric
| Component | Max Points | What It Measures |
|-----------|------------|------------------|
| **Workload Balance** | 25 | Weighted load vs capacity, WIP management |
| **Work Variety** | 20 | Type diversity, technology exposure, skill breadth |
| **Complexity Match** | 20 | Appropriate challenge level, growth trajectory |
| **Coding Balance** | 20 | >60% coding for developers (penalty if <50%) |
| **Temporal Health** | 10 | After-hours work, continuous work patterns |
| **Growth Trajectory** | 5 | Increasing complexity, new skills, stretch work |

**Total Score Interpretation:**
- 🟢 **70-100:** Healthy - Well-balanced, appropriate challenge
- 🟡 **50-69:** Concerning - Some imbalance, monitor trends
- 🟠 **30-49:** At Risk - Significant issues, intervention recommended
- 🔴 **0-29:** Critical - Immediate action required

## Common Risk Flags

### 🔴 Critical (Immediate Action Required)
- **Burnout Risk:** Weighted load >2.5x healthy capacity OR >7 active items
- **Non-Coding Overload:** >30% non-coding work for developers
- **Overspecialization:** >80% work in single type OR <3 technologies

### 🟠 Concerning (Monitor & Plan Intervention)
- **Stagnation:** 90%+ low-complexity work, no new technologies
- **Under-Challenged:** Consistently below capability level

### 🟡 Minor (Worth Discussing)
- **WIP Overload:** 5-6 active items, context switching concerns
- **After-Hours Pattern:** Regular evening/weekend work

## Custom Intent Examples

### Career Development
```json
{ 
  "additionalIntent": "check for career growth opportunities"
}
```
Focus: Skill gaps, learning patterns, stretch assignment opportunities

### Promotion Assessment
```json
{
  "additionalIntent": "assess readiness for senior engineer promotion - look for leadership, mentorship, and architecture work"
}
```
Focus: Leadership activities, complex problem-solving, technical influence

### Skill Development
```json
{
  "additionalIntent": "evaluate technical skill development and identify opportunities for full-stack growth"
}
```
Focus: Technology exposure, skill breadth, learning trajectory

### Team Fit
```json
{
  "additionalIntent": "evaluate suitability for platform engineering team transition"
}
```
Focus: Infrastructure work, cross-cutting concerns, systems thinking

## Output Structure

### 1. Executive Summary
- Overall health score & status
- Primary concerns (top 2-3)
- Analysis period details

### 2. Work Summary
- Completed work metrics (velocity, cycle time)
- Active load assessment (WIP status, weighted load)
- Estimation quality

### 3. Risk Flags
- Critical issues requiring immediate action
- Concerning patterns to monitor
- Minor concerns worth discussing
- Positive indicators to celebrate

### 4. Detailed Analysis
Six dimensions scored individually:
1. Workload Balance (0-25)
2. Work Variety & Specialization (0-20)
3. Coding vs Non-Coding Balance (0-20)
4. Complexity Match & Growth (0-20)
5. Temporal Health (0-10)
6. Growth Trajectory (0-5)

### 5. Custom Intent Analysis (if provided)
- Key findings related to intent
- Specific recommendations
- Supporting evidence from work items

### 6. Action Items
- **Immediate:** This week (prioritized)
- **Short-term:** Next 2-4 weeks
- **Long-term:** Next quarter
- **Manager Discussion Points**
- **Self-Care Recommendations**

### 7. Top Work Items Analyzed
Sample table of 10-20 recent/active items for context

## Privacy & Ethics

### ⚠️ Important Constraints
- Analysis is **indirect evidence** - not actual hours worked
- Timestamps may be timezone artifacts or scheduled tasks
- Should be used **constructively** to help, not harm
- Results should be **shared with the person** being analyzed
- Cannot definitively measure effort or hours worked

### Responsible Use
✅ **Do Use For:**
- Supporting employee well-being
- Career development discussions
- Proactive burnout prevention
- Identifying growth opportunities

❌ **Don't Use For:**
- Punitive measures
- Performance ranking
- Termination justification
- Public shaming or comparison

## Technical Notes

### Data Sources
- **OData Analytics API** - Historical completion metrics, velocity
- **WIQL Queries** - Real-time active work, Story Points
- **Context Package API** - Detailed item analysis (relations, history, comments)
- **Effort Analysis Tools** - Story Points coverage check & auto-estimation

### Pre-filled Variables
The prompt automatically provides:
- `{{area_path}}` - Configured area path filter
- `{{start_date}}` & `{{end_date}}` - Calculated date range
- `{{assigned_to_email}}` - Person being analyzed
- `{{analysis_period_days}}` - Days of history

### AI-Powered Components
Uses VS Code language model sampling for:
- Pattern recognition across work items
- Career development recommendations
- Custom intent analysis
- Nuanced interpretation beyond metrics

### Typical Execution Time
- **Standard analysis:** 30-60 seconds
- **With custom intent:** 60-90 seconds
- **Large datasets (180+ days):** 90-120 seconds

## Integration with Other Tools

### Complementary Analysis
- **Team Velocity Analyzer:** Compare individual to team patterns
- **Unified Work Item Analyzer:** Deep dive on specific concerning items
- **Hierarchy Validator:** Check if work is properly scoped/parented

### Follow-up Actions
After analysis, you might:
- Use `wit-bulk-assign-by-query-handle` to rebalance workload
- Use `wit-create-new-item` to create skill development tasks
- Use `wit-bulk-add-comments` to document discussion points on items
- Use `wit-assign-to-copilot` for AI-suitable work to free capacity

## Example Scenarios

### Scenario 1: Burnout Prevention
**Context:** Manager noticed engineer seems stressed
**Tool Usage:**
```json
{
  "assignedToEmail": "alice@contoso.com",
  "analysisPeriodDays": 90
}
```
**Result:** Identified 8 active high-priority items (WIP overload), 35% non-coding work (LiveSite), continuous work for 28 days. Health score: 28/100 (Critical).
**Action:** Immediately rebalance workload, assign AI-suitable tasks to Copilot, reduce LiveSite rotation.

### Scenario 2: Career Growth Check
**Context:** Quarterly 1:1 conversation
**Tool Usage:**
```json
{
  "assignedToEmail": "bob@contoso.com",
  "analysisPeriodDays": 120,
  "additionalIntent": "check for career growth opportunities and identify skill gaps"
}
```
**Result:** 85% Task work (low complexity), only 2 technologies touched, no Features/Epics. Health score: 52/100 (Concerning - stagnation risk).
**Action:** Assign stretch Feature work, pair with senior engineer, create skill development plan.

### Scenario 3: Promotion Assessment
**Context:** Engineer nominated for senior promotion
**Tool Usage:**
```json
{
  "assignedToEmail": "carol@contoso.com",
  "analysisPeriodDays": 180,
  "additionalIntent": "assess readiness for senior engineer promotion - look for leadership, mentorship, architecture, and complex problem-solving"
}
```
**Result:** 45% Feature/Epic work, 6 cross-team initiatives, evidence of mentorship in comments, increasing complexity trend. Health score: 78/100 (Healthy).
**Action:** Strong promotion candidate - compile evidence from analysis for promotion packet.

## Limitations

### What It Can't Do
- ❌ Measure actual hours worked
- ❌ Track work done outside Azure DevOps
- ❌ Assess code quality directly
- ❌ Evaluate interpersonal skills
- ❌ Measure meeting time or communication overhead
- ❌ Capture informal mentorship not in comments

### What It Can Infer
- ✅ Work volume and complexity trends
- ✅ Skill diversity and technology exposure
- ✅ Work-life balance patterns (timestamps)
- ✅ Growth trajectory (complexity over time)
- ✅ Specialization vs generalization
- ✅ WIP management and context switching

## Troubleshooting

### "Analysis returned in markdown format"
- AI didn't return structured JSON
- Result still useful - full markdown analysis preserved
- Check `detailedAnalysis.workloadBalance.assessment` for full text

### "No work items found"
- Check email address is exact match (case-sensitive)
- Verify person has work in configured area path
- Try expanding analysis period (e.g., 180 days)

### "Timeout exceeded"
- Analysis period may be too long (>365 days)
- Try reducing `analysisPeriodDays` to 90 or 120
- Check if area path has thousands of items

### Low estimation coverage
- Tool automatically estimates Story Points gaps
- Manual estimates always preserved
- Low confidence AI estimates flagged for review

## Related Documentation
- [Team Velocity Analyzer](../prompts/team_velocity_analyzer.md) - Team-wide analysis
- [Unified Work Item Analyzer](../prompts/unified_work_item_analyzer.md) - Single item deep dive
- [Common Workflows](./common-workflows.md) - Integration patterns
- [Tool Selection Guide](./tool-selection-guide.md) - When to use which tool
