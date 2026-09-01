---
id: "T-F004-2"
feature_id: "F-004"
slug: "personal-list-lifecycle"
title: "实现个人清单生命周期与显式删除策略"
status: "done"
depends_on: ["T-F004-1"]
test_command: "npm test -- tests/domain/organization.test.js tests/storage/list-repository.test.js tests/storage/task-repository.test.js"
acceptance_criteria: ["可以创建清单、按稳定 ID 读取清单，并通过重命名更新名称和 updatedAt，同时保持 id、createdAt 不变。","删除包含任务的清单但未指定策略时返回 POLICY_REQUIRED 和明确修正动作，清单与关联任务均保持原样。","使用 unassign 删除时清单被删除，原关联任务仍存在且 listId 为 null。","使用 move 删除时所有原关联任务迁移到指定的现存目标清单；目标不存在、等于源清单或策略非法时操作原子失败。","对已删除清单重复执行相同删除请求不重复迁移或修改任务，且不影响无关清单和任务。"]
files_hint: ["src/domain/organization.js","src/storage/list-repository.js","src/storage/task-repository.js","tests/domain/organization.test.js","tests/storage/list-repository.test.js","tests/storage/task-repository.test.js"]
---

# T-F004-2 — 实现个人清单生命周期与显式删除策略

实现仅面向个人用户的本地清单模型与仓储，支持使用稳定唯一 ID 创建、读取和重命名非空名称的清单，并记录可比较的 createdAt、updatedAt。删除清单必须显式传入任务处理策略：unassign 保留任务并将其 listId 置空，move 保留任务并迁移到已存在且不同于源清单的目标清单；未给策略、策略非法或迁移目标无效时拒绝整个操作且不修改清单或任务。成功处理关联任务后再删除清单，重复删除保持幂等，其他清单及任务不受影响。不得加入共享清单、成员、评论或权限角色。覆盖 TC-ORG-1。

## Acceptance criteria

- [ ] 可以创建清单、按稳定 ID 读取清单，并通过重命名更新名称和 updatedAt，同时保持 id、createdAt 不变。
- [ ] 删除包含任务的清单但未指定策略时返回 POLICY_REQUIRED 和明确修正动作，清单与关联任务均保持原样。
- [ ] 使用 unassign 删除时清单被删除，原关联任务仍存在且 listId 为 null。
- [ ] 使用 move 删除时所有原关联任务迁移到指定的现存目标清单；目标不存在、等于源清单或策略非法时操作原子失败。
- [ ] 对已删除清单重复执行相同删除请求不重复迁移或修改任务，且不影响无关清单和任务。
