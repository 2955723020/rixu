# 日序使用教程

日序是一款日期驱动的个人任务管理工具。项目包含可直接使用的 React Web 前端，以及任务生命周期、中文日期解析、重复规则、任务视图、清单与标签、子任务、提醒、统计和本地优先同步等领域能力。

> 当前仓库包含 **Node.js 领域逻辑库**与可直接启动的 React Web 前端。前端数据保存在浏览器 `localStorage`；项目仍没有 HTTP API 和数据库驱动，通知与云同步需要使用方接入平台适配器。

## 1. 环境要求

- Node.js 20 或更高版本
- npm

根目录领域库没有第三方运行依赖，可直接运行测试：

```bash
npm test
```

Web 前端依赖 React、Vite、Zustand 和 Tailwind CSS，首次运行需要安装 `web/` 子项目依赖。

## 2. 启动日序

```bash
cd web
npm install
npm run dev
```

打开终端输出的本地地址，即可开始使用。任务、清单、筛选条件、主题和用户时区保存在当前浏览器的 `localStorage` 中，不会上传到服务器。

常用操作：

- 在顶部输入任务标题，或输入 `明天下午3点 评审方案`，确认识别结果后添加。
- 从左侧进入今天、未来、逾期、已完成、日历和统计视图。
- 点击任务行编辑日期、时间、时区、优先级、清单、标签、重复规则和子任务。
- 使用左侧清单、标签、优先级或顶部搜索框进行跨日期筛选。
- 在日历中切换月/周视图，选择日期后可直接创建当天任务。
- 在左侧底部覆盖用户时区；今天、逾期、日历和统计会使用该时区计算。

生产构建与自动化验证：

```bash
npm test
npm run build
npm run test:e2e
```

升级自旧版 TeamOS 前端时，日序会自动把 `teamos:v1` 中的浏览器数据迁移到 `rixu:v1`，已有任务不会因改名丢失。

### 专注模式

可以从顶部计时器按钮开始临时主题专注，从任一任务行的播放按钮开始关联任务专注，也可以在左侧“专注统计”页面开始。开始前可选择番茄钟或自由计时：番茄钟按设置时长倒计时，自由计时从零正向计时。

专注过程中可以暂停、继续、提前结束或退出沉浸界面；退出后底部迷你计时条仍保留当前会话。刷新或重新打开页面时，活动会话会恢复为暂停状态，关闭页面期间不计时。番茄到点后会先保存记录，再由用户手动开始休息，不会自动进入下一轮。

专注历史独立保存在浏览器 `localStorage` 的 `rixu-focus:v1` 中，任务数据仍使用 `rixu:v1`。左侧“专注统计”按当前用户时区展示今日、本周、最近七天、主题分布和最近记录。专注结束只保存投入时长，不会自动完成、恢复或修改关联任务；删除任务也不会删除已有专注历史。

## 3. 领域库五分钟快速开始

本项目使用原生 ES Modules。自己编写调用脚本时，请使用 `.js`/`.mjs` 文件，或通过 `node --input-type=module` 执行标准输入中的示例。

下面的命令会在内存中创建、修改并完成一条任务，不会写入项目文件或外部数据库：

```bash
node --input-type=module <<'JS'
import { TaskRepository } from './src/storage/task-repository.js';

const tasks = new TaskRepository();

const created = tasks.create({
  title: '准备周会',
  dueDate: '2026-09-01',
  startAt: '2026-09-01T09:00',
  endAt: '2026-09-01T09:30',
  timezone: 'Asia/Shanghai',
  tags: ['工作'],
  priority: 'high',
});

if (!created.ok) {
  console.error(created.errors);
  process.exitCode = 1;
} else {
  const taskId = created.task.id;
  tasks.update(taskId, { title: '准备产品周会' });
  tasks.complete(taskId);
  console.log(tasks.getById(taskId));
}
JS
```

输出中的任务具有稳定 ID、ISO 时间戳和完成状态，例如：

```js
{
  id: '...',
  title: '准备产品周会',
  dueDate: '2026-09-01',
  startAt: '2026-09-01T01:00:00.000Z',
  endAt: '2026-09-01T01:30:00.000Z',
  timezone: 'Asia/Shanghai',
  status: 'completed',
  completedAt: '...',
  tags: ['工作'],
  priority: 'high'
}
```

`startAt` 和 `endAt` 输入为用户时区中的本地时间，保存后转换为可比较的 UTC ISO 时间。

## 4. 统一返回值与错误处理

会执行校验或持久化的 API 通常返回以下两种结构之一：

```js
// 成功
{ ok: true, task: { /* ... */ } }

// 失败
{
  ok: false,
  errors: [
    {
      field: 'dueDate',
      code: 'INVALID_DATE',
      message: '...',
      action: '...'
    }
  ],
  input: { /* 原始输入 */ }
}
```

调用方应先判断 `ok`，再读取 `task`、`list` 或 `errors`。校验失败不会写入部分数据，`errors[].action` 给出了建议的修正动作。

## 5. 任务生命周期

### 创建任务

```js
import { TaskRepository } from './src/storage/task-repository.js';

const repository = new TaskRepository();
const result = repository.create({
  title: '提交月报',
  dueDate: '2026-09-30',
  timezone: 'Asia/Shanghai',
  recurrence: { frequency: 'monthly' },
  listId: null,
  tags: ['汇报'],
  priority: 'urgent',
});
```

必填字段：

- `title`：非空标题。
- `dueDate`：真实存在的 `YYYY-MM-DD` 日期。

常用可选字段：

- `timezone`：IANA 时区，例如 `Asia/Shanghai`；省略时使用 `UTC`。
- `startAt`、`endAt`：`YYYY-MM-DDTHH:mm` 格式的本地时间。
- `recurrence`：结构化重复规则。
- `listId`：所属清单 ID。
- `tags`：不重复的非空字符串数组。
- `priority`：`urgent`、`high`、`medium`、`low` 或 `none`。
- `parentId`：父任务 ID。

如果同时提供开始和结束时间，`endAt` 不能早于 `startAt`。夏令时切换造成的无效本地时间也会被拒绝。

### 查询、更新、完成和删除

```js
const taskId = result.task.id;

repository.getById(taskId);                 // 不存在时返回 null
repository.getAll();                        // 返回全部任务
repository.update(taskId, { priority: 'high' });
repository.addTag(taskId, '重点');
repository.removeTag(taskId, '汇报');

repository.complete(taskId);                // pending -> completed
repository.uncomplete(taskId);              // completed -> pending

repository.delete(taskId);                  // 失败：未明确确认
repository.delete(taskId, { confirmed: true });
```

重复调用 `complete`、`uncomplete` 或已确认的 `delete` 是幂等的。完成任务时会记录 `completedAt`，恢复未完成时会将其清空。

## 6. 中文自然语言日期

```js
import { parseChineseDate } from './src/domain/date-parser.js';

const draft = parseChineseDate('明天下午3点', {
  now: new Date('2026-08-31T08:00:00.000Z'),
  timeZone: 'Asia/Shanghai',
});

console.log(draft);
// {
//   originalText: '明天下午3点',
//   status: 'success',
//   dueDate: '2026-09-01',
//   time: '15:00',
//   recurrence: null,
//   missingFields: [],
//   nextAction: null
// }
```

解析状态有三种：

- `success`：日期和时间都已识别。
- `partial`：只识别到部分字段，`missingFields` 列出待补字段。
- `failure`：无法识别，需要根据 `nextAction: 'manual-date-time'` 转入手动选择。

当前解析器只覆盖“明天”和“下午 N 点/分”这一组受控表达，例如 `明天下午3点`、`明天下午3点30分`。它尚不是通用中文自然语言解析器；其他表达应提供日期/时间选择器作为回退，不能把失败结果直接保存。

## 7. 重复任务规则

`calculateNextOccurrence` 计算下一期日期，同时返回规范化后的重复规则：

```js
import { calculateNextOccurrence } from './src/domain/recurrence.js';

calculateNextOccurrence({
  dueDate: '2026-09-01',
  recurrence: { frequency: 'daily' },
});
// { dueDate: '2026-09-02', recurrence: { frequency: 'daily', interval: 1 } }

calculateNextOccurrence({
  dueDate: '2026-09-01',
  recurrence: { frequency: 'weekly', interval: 2, weekdays: [1, 3] },
});

calculateNextOccurrence({
  dueDate: '2026-01-31',
  recurrence: { frequency: 'monthly' },
});
// 下一期为 2026-02-28，并保留 anchorDay: 31

calculateNextOccurrence({
  dueDate: '2026-09-01',
  recurrence: { frequency: 'custom', interval: 3, unit: 'day' },
});
```

支持的规则如下：

| 类型 | 示例 | 说明 |
| --- | --- | --- |
| 每日 | `{ frequency: 'daily', interval: 2 }` | 每两天一次 |
| 每周 | `{ frequency: 'weekly', weekdays: [1, 3] }` | ISO 星期，1 为周一，7 为周日 |
| 每月 | `{ frequency: 'monthly' }` | 月末自动回退，并保留原始日期锚点 |
| 自定义 | `{ frequency: 'custom', interval: 2, unit: 'week' }` | `unit` 支持 `day`、`week`、`month` |

注意：当前 `TaskRepository.complete()` 只完成当前任务，不会自动创建下一期实例。上层应用需要在完成成功后调用 `calculateNextOccurrence()`，再通过仓库创建新任务。

## 8. 今日、未来、逾期、已完成和日历视图

查询函数接收任务数组，不会修改原数据：

```js
import {
  getTodayTasks,
  getFutureTasks,
  getOverdueTasks,
  getCompletedTasks,
  getTasksForView,
} from './src/query/task-views.js';
import { buildCalendarIndex, selectCalendarDate } from './src/query/calendar-view.js';

const allTasks = repository.getAll();
const context = {
  now: new Date().toISOString(), // 必须是带 Z 或时区偏移的绝对时间
  timeZone: 'Asia/Shanghai',
};

const today = getTodayTasks(allTasks, context);
const future = getFutureTasks(allTasks, context);
const overdue = getOverdueTasks(allTasks, context);
const completed = getCompletedTasks(allTasks);
const selected = getTasksForView(allTasks, 'today', context);

const calendar = buildCalendarIndex(allTasks);
const dateCell = selectCalendarDate(allTasks, '2026-09-01');
```

逾期查询只返回未完成任务，并按有效截止时刻升序排列。有 `endAt` 时使用该绝对时间；无具体时间时，任务在用户本地截止日结束后才算逾期。返回项额外包含 `isOverdue`、`highlightColor`、`overdueLabel` 和 `overdueIcon`，便于界面同时用颜色和语义标识逾期。

`getTasksForView` 支持 `today`、`future`、`overdue` 和 `completed`。日历视图由 `buildCalendarIndex`/`selectCalendarDate` 单独提供。

## 9. 清单、标签、优先级和子任务

### 清单

`ListRepository` 与 `TaskRepository` 应共享同一个任务仓库实例：

```js
import { ListRepository } from './src/storage/list-repository.js';

const lists = new ListRepository({ taskRepository: repository });
const work = lists.create({ name: '工作' });
const home = lists.create({ name: '生活' });

lists.rename(work.list.id, '核心工作');

// 删除清单时必须明确任务保留策略：
lists.delete(work.list.id, { strategy: 'unassign' });
// 或迁移到另一个现有清单：
// lists.delete(work.list.id, { strategy: 'move', targetListId: home.list.id });
```

按组织属性筛选和排序：

```js
import {
  filterByListId,
  filterByTag,
  filterByPriority,
  sortByPriority,
} from './src/query/organization-filters.js';

filterByListId(repository.getAll(), home.list.id);
filterByTag(repository.getAll(), '重点');
filterByPriority(repository.getAll(), 'high');
sortByPriority(repository.getAll());
```

优先级固定顺序为 `urgent`、`high`、`medium`、`low`、`none`，同级任务保持原顺序。

### 子任务

```js
const parent = repository.create({ title: '发布版本', dueDate: '2026-09-10' });
const child = repository.createSubtask(parent.task.id, {
  title: '整理变更记录',
  dueDate: '2026-09-09',
});

repository.getChildren(parent.task.id);
repository.getParent(child.task.id);

repository.complete(parent.task.id); // 子任务未完成时返回失败
repository.complete(child.task.id);
repository.complete(parent.task.id); // 此时可以完成
```

仓库会拒绝不存在的父任务、自引用和循环父子关系。

## 10. 到期提醒

提醒服务只负责规则和状态，不直接调用操作系统通知。使用时需要提供：

- `scheduler.schedule(key, triggerAt)`：创建平台通知。
- `scheduler.cancel(key)`：取消平台通知。
- `permissionProbe()`：返回通知权限是否已授予。

```js
import { ReminderService } from './src/application/reminders.js';

const scheduler = {
  schedule(key, triggerAt) {
    console.log('安排提醒', key, triggerAt);
  },
  cancel(key) {
    console.log('取消提醒', key);
  },
};

const reminders = new ReminderService({
  repository,
  scheduler,
  permissionProbe: () => true,
});

const reminderTask = repository.create({
  title: '参加评审',
  dueDate: '2026-09-02',
  endAt: '2026-09-02T15:00',
  timezone: 'Asia/Shanghai',
});
const reminderTaskId = reminderTask.task.id;

reminders.schedulePendingTask(reminderTaskId);
reminders.getNotificationState(reminderTaskId);
reminders.disableReminder(reminderTaskId);
reminders.retrySchedule(reminderTaskId);

repository.complete(reminderTaskId);
reminders.handleTaskCompleted(reminderTaskId);
```

有 `endAt` 的任务以结束时刻提醒；无具体时间的任务默认在截止日当地 09:00 提醒。权限拒绝或调度器失败时，服务返回可重试的 `pending` 状态。完成任务后，上层应用应调用 `handleTaskCompleted` 取消已有提醒。

## 11. 完成统计

```js
import {
  calculateCompletionRate,
  buildCompletionHeatmap,
} from './src/query/statistics.js';

const instances = repository.getAll();

const completion = calculateCompletionRate(instances, {
  from: '2026-09-01',
  to: '2026-09-30',
});
// { completed, expected, rate }

const heatmap = buildCompletionHeatmap(instances, {
  from: '2026-09-01',
  to: '2026-09-30',
  timezone: 'Asia/Shanghai',
});
// { '2026-09-01': 2, '2026-09-02': 1, ... }
```

完成率的分母排除 `cancelled` 实例。热力图按 `completedAt` 在指定时区中的本地日期聚合；重复任务应将每个实际生成的任务实例分别传入。

## 12. 本地优先与云同步

本地优先流程由以下组件组成：

```text
LocalStore -> TaskRepository/ListRepository（立即本地生效）
           -> SyncQueue（记录待上传操作）
           -> CloudAdapter（由应用接入真实云服务）
           -> SyncCoordinator（上传、拉取和冲突收敛）
```

最小示例：

```js
import { TaskRepository } from './src/storage/task-repository.js';
import { LocalStore } from './src/storage/local-store.js';
import { SyncQueue } from './src/sync/sync-queue.js';
import { SyncCoordinator } from './src/sync/sync-coordinator.js';

const adapter = {
  async upload(operation) {
    // 将 operation 幂等地发送到你的服务端。
  },
  async pull({ accountId, cursor }) {
    // 返回 []，或 { changes, cursor, hasMore }。
    return [];
  },
};

const taskRepository = new TaskRepository();
const queue = new SyncQueue({
  accountId: 'account-1',
  deviceId: 'device-a',
  adapter,
});
const store = new LocalStore({ taskRepository, syncQueue: queue });
const coordinator = new SyncCoordinator({
  localStore: store,
  queue,
  adapter,
});

// 本地写入立即完成，同时操作进入同步队列。
const local = store.createTask({
  title: '离线也能创建',
  dueDate: '2026-09-01',
});

await coordinator.sync();
console.log(queue.diagnostics());
```

上传失败不会撤销本地修改。网络恢复后可调用 `coordinator.retry()` 或 `queue.retryAll()`。诊断信息不包含任务标题和标签等内容。

同步适配器约定：

- `upload(operation)` 应使用 `operation.idempotencyKey` 保证重试不产生重复写入。
- `pull()` 返回完整快照或 tombstone；分页响应可使用 `{ changes, cursor, hasMore }`。
- 同一实体的冲突按 `updatedAt`、`deviceId` 和稳定次级键确定性解决。
- `SyncQueue` 和仓库当前使用内存存储；应用重启后的持久化需要宿主应用自行实现。

## 13. 项目结构

```text
src/
  domain/       任务、日期、时区、重复规则、组织和子任务规则
  storage/      内存任务/清单仓库与本地优先门面
  query/        核心视图、日历、筛选和统计
  application/  提醒应用服务
  sync/         同步队列、冲突解决和同步协调
tests/          与 src 分层对应的 Node.js 自动化测试
doc/            产品约束、流程、功能与任务说明
web/            React Web 前端、前端测试与浏览器测试
```

需要理解某个 API 的完整边界时，优先阅读同名测试。例如任务仓库对应 `tests/storage/task-repository.test.js`，同步协调器对应 `tests/sync/sync-coordinator.test.js`。

## 14. 当前实现边界

- 已提供响应式 Web UI；目前没有原生移动端应用、CLI 或 HTTP API。
- 仓库和同步队列默认只保存在内存中，进程退出后数据不会保留。
- 中文日期解析目前只覆盖有限的“明天 + 下午时间”表达。
- 完成重复任务后不会自动创建下一期，需要上层编排。
- 通知调度器、通知权限和云端传输需要平台侧实现。
- 没有身份认证实现；同步调用方负责提供稳定的账户和设备 ID。

产品目标与完整业务规则参见 [`prd.md`](./prd.md)，强制约束参见 [`doc/CONSTRAINTS.md`](./doc/CONSTRAINTS.md)，实现拆分参见 [`doc/PLAN.md`](./doc/PLAN.md)。
