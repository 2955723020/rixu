---
id: "T-F005-1"
feature_id: "F-005"
slug: "reminder-scheduling-and-notification-state"
title: "Implement deadline reminder scheduling and notification failure state"
status: "done"
depends_on: []
test_command: "npm test -- tests/application/reminders.test.js"
acceptance_criteria: ["A pending task with endAt schedules exactly at endAt, while a pending task without endAt schedules at dueDate 09:00 interpreted in its timezone; invalid timezone conversion returns a fielded failure instead of guessing.","Disabled reminders produce no new schedule and cancel any existing schedule; repeating disable calls do not create extra scheduler operations.","Handling a completed task cancels its outstanding reminder and subsequent scheduling attempts refuse to create an unfinished reminder.","Notification permission denial and scheduler exceptions transition the task's notification state to a machine-readable pending state with an actionable reason, retain the task in the repository, and allow a later retry after the dependency recovers.","Scheduler calls and notification-state records use task IDs/opaque keys only and do not log task titles; repeated schedule, cancel, completion, and retry operations are idempotent."]
files_hint: ["src/application/reminders.js","src/domain/notification-state.js","tests/application/reminders.test.js"]
---

# T-F005-1 — Implement deadline reminder scheduling and notification failure state

Using the existing TaskRepository, timezone conversion utilities, and F-002 completion lifecycle, add a ReminderService in src/application/reminders.js plus structured per-task notification state in src/domain/notification-state.js. The service must expose deterministic operations to schedule a pending task, disable its reminder, cancel it when the task completes, inspect its state, and retry a failed schedule. Use an injected scheduler adapter with schedule(key, triggerAt) and cancel(key), and an injected notification-permission probe. For a task with endAt, schedule at that stored ISO instant; otherwise convert dueDate at local 09:00 in the task timezone. Keep notification state keyed by task ID, preserve the task when permission or scheduling fails, return an actionable pending/error state, avoid blocking completion or task writes, and make scheduling, cancellation, disabling, and retry idempotent.

## Acceptance criteria

- [ ] A pending task with endAt schedules exactly at endAt, while a pending task without endAt schedules at dueDate 09:00 interpreted in its timezone; invalid timezone conversion returns a fielded failure instead of guessing.
- [ ] Disabled reminders produce no new schedule and cancel any existing schedule; repeating disable calls do not create extra scheduler operations.
- [ ] Handling a completed task cancels its outstanding reminder and subsequent scheduling attempts refuse to create an unfinished reminder.
- [ ] Notification permission denial and scheduler exceptions transition the task's notification state to a machine-readable pending state with an actionable reason, retain the task in the repository, and allow a later retry after the dependency recovers.
- [ ] Scheduler calls and notification-state records use task IDs/opaque keys only and do not log task titles; repeated schedule, cancel, completion, and retry operations are idempotent.
