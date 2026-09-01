---
id: "T-F003-1"
feature_id: "F-003"
slug: "task-view-query-layer"
title: "实现今日、未来、逾期和已完成任务查询"
status: "done"
depends_on: []
test_command: "npm test -- tests/query/task-views.test.js"
acceptance_criteria: ["在固定 `now` 与用户 `timeZone` 下，今日查询只返回本地日期等于今天的未完成任务，未来查询只返回本地日期晚于今天的未完成任务，并排除无截止日期任务。","逾期查询对有 `endAt` 的任务使用严格的当前时刻比较，对无具体结束时间的任务使用用户本地截止日结束时刻比较；边界时刻不提前判定逾期。","逾期结果按有效截止时刻升序排列，每项同时携带红色高亮字段和文本或图标语义字段；已完成任务不出现在逾期结果中。","已完成查询只返回已完成且有 `completedAt` 的任务，并按完成时间稳定排序；将同一任务改为 pending 且清除 `completedAt` 后，该任务从结果中移除。","查询函数为纯函数，调用今日、未来、逾期、已完成查询及视图切换后，输入任务的日期、时间、时区和重复规则保持深度相等。"]
files_hint: ["src/query/task-views.js","tests/query/task-views.test.js","src/domain/timezone.js"]
---

# T-F003-1 — 实现今日、未来、逾期和已完成任务查询

在当前纯 Node.js 领域库中新增 `src/query/task-views.js`，提供纯函数 `getTodayTasks(tasks, { now, timeZone })`、`getFutureTasks(tasks, { now, timeZone })`、`getOverdueTasks(tasks, { now, timeZone })`、`getCompletedTasks(tasks)` 以及可选的 `getTasksForView(tasks, view, options)` 统一入口。`now` 必须按绝对时间解析，`timeZone` 使用用户 IANA 时区并通过现有时区工具换算本地日期。今日只保留本地日期等于今天且 `status === 'pending'` 的任务；未来只保留本地截止日期晚于今天且未完成的任务；缺少或无效截止日期的任务不进入这三类视图。逾期只保留未完成任务：有 `endAt` 时仅在当前时刻严格晚于结束瞬间才逾期；没有具体结束时间时，以用户时区截止日 `23:59:59.999` 之后才逾期。逾期结果按有效截止瞬间升序排列，并为每项附加非颜色语义，例如 `isOverdue: true`、`highlightColor: 'red'`、`overdueLabel: 'Overdue'` 和 `overdueIcon: 'alert'`。已完成视图只返回 `status === 'completed'` 且 `completedAt` 非空的任务，按 `completedAt` 升序返回并在任务恢复为 pending、`completedAt` 清空后立即排除。所有函数不得修改输入数组或任务对象，必须保留原始 `dueDate`、`startAt`、`endAt`、`timezone` 和 `recurrence`。

## Acceptance criteria

- [ ] 在固定 `now` 与用户 `timeZone` 下，今日查询只返回本地日期等于今天的未完成任务，未来查询只返回本地日期晚于今天的未完成任务，并排除无截止日期任务。
- [ ] 逾期查询对有 `endAt` 的任务使用严格的当前时刻比较，对无具体结束时间的任务使用用户本地截止日结束时刻比较；边界时刻不提前判定逾期。
- [ ] 逾期结果按有效截止时刻升序排列，每项同时携带红色高亮字段和文本或图标语义字段；已完成任务不出现在逾期结果中。
- [ ] 已完成查询只返回已完成且有 `completedAt` 的任务，并按完成时间稳定排序；将同一任务改为 pending 且清除 `completedAt` 后，该任务从结果中移除。
- [ ] 查询函数为纯函数，调用今日、未来、逾期、已完成查询及视图切换后，输入任务的日期、时间、时区和重复规则保持深度相等。
