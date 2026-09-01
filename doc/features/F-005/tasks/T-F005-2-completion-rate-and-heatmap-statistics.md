---
id: "T-F005-2"
feature_id: "F-005"
slug: "completion-rate-and-heatmap-statistics"
title: "Implement completion-rate and local-date heatmap queries"
status: "done"
depends_on: []
test_command: "npm test -- tests/query/statistics.test.js"
acceptance_criteria: ["For a fixed inclusive due-date range, calculateCompletionRate returns completed and expected instance counts and the exact completed/expected ratio.","Instances marked cancelled are excluded from the expected denominator, and an empty denominator yields rate 0 without NaN or Infinity.","buildCompletionHeatmap converts each completedAt instant through the supplied IANA timezone and aggregates counts by local YYYY-MM-DD, including separate counts for separate repeated instances.","Both queries leave the input instance array and its nested task/recurrence data unchanged and produce deterministic results for the same inputs."]
files_hint: ["src/query/statistics.js","tests/query/statistics.test.js"]
---

# T-F005-2 — Implement completion-rate and local-date heatmap queries

Add src/query/statistics.js with pure, defensive-copy query functions calculateCompletionRate(instances, { from, to, timezone }) and buildCompletionHeatmap(instances, { from, to, timezone }). Treat from and to as inclusive YYYY-MM-DD dates in the user's timezone. For completion rate, select instances by their dueDate in that range, count status completed with a non-null completedAt as completed, count every selected instance except status cancelled as expected, and return { completed, expected, rate }, using rate 0 when expected is zero. For the heatmap, count only completed instances whose completedAt converts to a local date in the requested range and return a date-keyed count object; each generated recurrence instance is counted independently by its own ID, without deduplicating by source task or recurrence rule.

## Acceptance criteria

- [ ] For a fixed inclusive due-date range, calculateCompletionRate returns completed and expected instance counts and the exact completed/expected ratio.
- [ ] Instances marked cancelled are excluded from the expected denominator, and an empty denominator yields rate 0 without NaN or Infinity.
- [ ] buildCompletionHeatmap converts each completedAt instant through the supplied IANA timezone and aggregates counts by local YYYY-MM-DD, including separate counts for separate repeated instances.
- [ ] Both queries leave the input instance array and its nested task/recurrence data unchanged and produce deterministic results for the same inputs.
