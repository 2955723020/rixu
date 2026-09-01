---
id: "T-F004-3"
feature_id: "F-004"
slug: "subtask-relations-and-completion-guard"
title: "实现子任务关系与父任务完成门禁"
status: "done"
depends_on: ["T-F004-1"]
test_command: "npm test -- tests/domain/subtask.test.js tests/storage/task-repository.test.js"
acceptance_criteria: ["可以为现有父任务创建子任务，子任务保存 parentId，并可从父任务读取全部直接子任务以及从子任务读取父任务。","父任务不存在、自引用或循环关系均返回定位到 parentId 的错误和修正动作，且原有关系保持不变。","父任务存在未完成子任务时，完成前检查返回 INCOMPLETE_SUBTASKS 和对应子任务 ID，父任务仍保持原状态且不会被静默标记完成。","所有直接子任务完成或父任务没有子任务时，完成前检查允许后续完成状态机继续处理。","子任务查询和完成门禁不修改任务的日期、重复规则、清单、标签或优先级。"]
files_hint: ["src/domain/subtask.js","src/storage/task-repository.js","tests/domain/subtask.test.js","tests/storage/task-repository.test.js"]
---

# T-F004-3 — 实现子任务关系与父任务完成门禁

在 TaskRepository 和独立子任务领域模块中实现父子关系。提供以现有任务为父项创建子任务、按父 ID 读取直接子任务、按子任务读取父任务的接口；拒绝不存在的父任务、自引用以及会形成循环的重新挂接，失败时不得写入。提供父任务完成前检查接口：存在未完成直接子任务时返回 INCOMPLETE_SUBTASKS、未完成子任务 ID 和明确的用户修正/确认动作，并且不修改父任务状态；若执行时已存在 F-002 完成入口，则将该门禁接入其父任务完成路径。不得引入新完成状态或自行改写 completedAt。覆盖 TC-ORG-4。

## Acceptance criteria

- [ ] 可以为现有父任务创建子任务，子任务保存 parentId，并可从父任务读取全部直接子任务以及从子任务读取父任务。
- [ ] 父任务不存在、自引用或循环关系均返回定位到 parentId 的错误和修正动作，且原有关系保持不变。
- [ ] 父任务存在未完成子任务时，完成前检查返回 INCOMPLETE_SUBTASKS 和对应子任务 ID，父任务仍保持原状态且不会被静默标记完成。
- [ ] 所有直接子任务完成或父任务没有子任务时，完成前检查允许后续完成状态机继续处理。
- [ ] 子任务查询和完成门禁不修改任务的日期、重复规则、清单、标签或优先级。
