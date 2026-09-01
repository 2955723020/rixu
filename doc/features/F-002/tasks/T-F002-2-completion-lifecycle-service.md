---
id: "T-F002-2"
feature_id: "F-002"
slug: "completion-lifecycle-service"
title: "实现完成状态机、重复实例生成与即时反馈"
status: "done"
depends_on: ["T-F002-1"]
test_command: "npm test -- tests/application/completion.test.js tests/domain/recurrence.test.js tests/domain/task.test.js tests/storage/task-repository.test.js"
acceptance_criteria: ["首次完成未完成任务后 status 为 completed、completedAt 非空且有一条状态变更事件；再次完成保持原 completedAt，不新增事件或重复实例。","恢复已完成任务后 status 为 pending、completedAt 为 null，并能通过 pending 查询返回；对 pending 任务执行恢复被拒绝且仓储不变。","完成非重复任务不生成下一期；完成重复任务保持当前实例已完成，并只生成一个新的未完成实例，实例具有 sourceTaskId 或 sourceRuleId、新 dueDate、继承的标题和组织属性。","重复规则生成委托给 recurrence-domain-rules，月末锚点行为在完成流程中保持正确。","状态和实例持久化完成后才投递正向反馈；反馈发布器被延迟、抛错或不可用时，completeTask 仍返回已持久化结果，并提供可消费的待处理反馈事件。","TaskRepository 的状态查询返回防御性副本，完成、恢复和重复生成操作均具备幂等性。","自动化测试覆盖 TC-REC-1、TC-REC-2、TC-REC-3、TC-REC-4 及反馈非阻塞和状态转换边界。"]
files_hint: ["src/application/completion.js","src/domain/completion-feedback.js","src/domain/task.js","src/storage/task-repository.js","tests/application/completion.test.js","tests/domain/recurrence.test.js","tests/domain/task.test.js","tests/storage/task-repository.test.js"]
---

# T-F002-2 — 实现完成状态机、重复实例生成与即时反馈

新增 src/application/completion.js 和 src/domain/completion-feedback.js，并扩展现有任务模型/TaskRepository 以支持受控生命周期转换和未完成查询。提供 completeTask(repository, taskId, dependencies) 与 reopenTask(repository, taskId, dependencies)：仅允许 pending->completed 和 completed->pending；完成时以注入时钟记录 ISO completedAt、updatedAt，并发布可消费的状态变更事件及即时正向反馈；恢复时清除 completedAt。持久化必须先于反馈发布，反馈发布不得阻塞或回滚已保存状态。完成带 recurrence 的任务时调用 recurrence-domain-rules 生成且幂等保存一个下一期 pending 实例，继承标题、组织属性(listId、tags、priority、parentId)、时区及重复规则，设置新的 dueDate，并保存 sourceTaskId 或 sourceRuleId；当前实例保持 completed。重复完成已完成任务不得修改其结果、重复发布状态事件或生成实例。为仓储增加按状态查询能力，使恢复后的任务重新出现在 pending 查询中；非法状态转换和不存在任务返回字段化错误。

## Acceptance criteria

- [ ] 首次完成未完成任务后 status 为 completed、completedAt 非空且有一条状态变更事件；再次完成保持原 completedAt，不新增事件或重复实例。
- [ ] 恢复已完成任务后 status 为 pending、completedAt 为 null，并能通过 pending 查询返回；对 pending 任务执行恢复被拒绝且仓储不变。
- [ ] 完成非重复任务不生成下一期；完成重复任务保持当前实例已完成，并只生成一个新的未完成实例，实例具有 sourceTaskId 或 sourceRuleId、新 dueDate、继承的标题和组织属性。
- [ ] 重复规则生成委托给 recurrence-domain-rules，月末锚点行为在完成流程中保持正确。
- [ ] 状态和实例持久化完成后才投递正向反馈；反馈发布器被延迟、抛错或不可用时，completeTask 仍返回已持久化结果，并提供可消费的待处理反馈事件。
- [ ] TaskRepository 的状态查询返回防御性副本，完成、恢复和重复生成操作均具备幂等性。
- [ ] 自动化测试覆盖 TC-REC-1、TC-REC-2、TC-REC-3、TC-REC-4 及反馈非阻塞和状态转换边界。
