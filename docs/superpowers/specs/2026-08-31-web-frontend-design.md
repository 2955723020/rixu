# 前端页面设计方案 · 日序任务管理系统

> 版本:v1 · 状态:待评审 · 日期:2026-08-31
> 范围:为现有纯逻辑后端新增一套美观、方便的 Web 前端。**不修改 `src/` 与 `tests/` 任何代码。**

---

## 1. 背景与目标

`c2` 是一个纯函数式、领域驱动(DDD)的任务管理系统,目前**只有后端逻辑与单元测试,没有任何前端、服务器、构建工具或第三方依赖**。本方案为其新增一套可用、美观的 Web 前端。

**核心约束:**
- 一行都不改 `src/` 与 `tests/`。前端把 `src` 当作纯逻辑库来消费。
- MVP 阶段**纯前端**,数据用 `localStorage` 持久化,**不做后端**(`sync` 层留接口,后续里程碑再接)。

**技术栈决策:** Vite + React + Tailwind CSS + shadcn/ui。

---

## 2. 关键技术事实(已核实)

- `src/domain/task.js` 的 `createTask(input, {clock, idGenerator})` 是**纯函数**,返回完整 task 对象(自带 id/时间戳),`clock` 与 `idGenerator` 均可注入。`updateTask(task, changes, {clock})` 同理。
- 校验失败统一返回 `{ ok: false, errors: [{field, code, message, action}] }`,成功返回 `{ ok: true, task }`。
- `src/query/*` 全为纯函数,接收 `tasks` 数组 + `{now, timeZone}`,投影出各视图(今天/未来/逾期/已完成、日历索引、完成率+热力图、按清单/标签/优先级过滤排序)。
- **唯一的浏览器不兼容点:** `task.js`、`organization.js`、`storage/list-repository.js`、`storage/task-repository.js` 顶部 `import { randomUUID } from 'node:crypto'`。浏览器无 `node:crypto`,但有原生 `crypto.randomUUID()`。→ 用 Vite alias 一个 shim 解决,零改 src。
- 除 `node:crypto` 外**无任何外部依赖**。

---

## 3. 架构与数据流

原则:**`src` 是纯逻辑库,前端只做表现层。**

```
┌─────────────────────────────────────────────────┐
│  React UI (页面/组件)  ← Tailwind + shadcn/ui     │
└───────────────┬─────────────────────────────────┘
                │ 读:query 函数    写:domain 函数
        ┌───────▼────────────────────────────┐
        │  Zustand Store (前端新增)            │
        │  单一数据源:tasks[] / lists[]       │
        │  persist 中间件 → localStorage       │
        └───────┬────────────────────────────┘
                │ 直接调用 src 纯函数
   ┌────────────▼───────────────────────────────┐
   │  src/domain/*  (createTask/updateTask/校验)  │  ← 不改
   │  src/query/*   (今天/逾期/日历/统计/过滤)     │  ← 不改
   └─────────────────────────────────────────────┘
```

**为什么用 Zustand 持有数组,而非有状态的 `LocalStore`(方案 A,已选定):**
`LocalStore`/`TaskRepository` 是内存 Map,与 `localStorage` 持久化相冲突(刷新后 Map 为空)。而 `domain`/`query` 全是纯函数:
- **单一数据源** = Zustand 里的 `tasks[]` / `lists[]`
- **写** = 调 `createTask`/`updateTask`(纯)→ 校验 `{ok}` → 更新数组
- **读** = 调 `query/*` 把数组投影成各视图
- **持久化** = `zustand/persist` 自动同步 `localStorage`,刷新不丢

**方案 B(未采用,记录为未来升级路径):** 完整复用 `LocalStore`,启动时用 `applyRemoteSnapshot({entityId, payload, updatedAt})` 按原 id 回灌数据。好处是保留 `sync` 层与子任务索引;代价是要处理 Map 回灌与版本号。待后端同步里程碑时再从 A 平滑升级到 B。

---

## 4. 目录结构(全部新增,不碰 `src/` `tests/`)

```
c2/
├── src/                    ← 一行不改
├── tests/                  ← 一行不改
├── web/                    ← 新增前端(独立子项目)
│   ├── index.html
│   ├── vite.config.js      # 关键:resolve.alias 'node:crypto' → ./shims/node-crypto.js
│   ├── package.json        # web 专属依赖,与根解耦
│   ├── shims/
│   │   └── node-crypto.js  # export const randomUUID = () => crypto.randomUUID()
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── store/
│       │   └── useTaskStore.js   # Zustand + persist,封装对 domain 的调用与错误归一
│       ├── lib/
│       │   └── clock.js          # 统一 now / timeZone(Intl 探测,可覆盖)
│       ├── pages/
│       │   ├── TaskListPage.jsx
│       │   ├── CalendarPage.jsx
│       │   └── StatsPage.jsx
│       ├── components/
│       │   ├── layout/{AppShell,Sidebar,Topbar}.jsx
│       │   ├── task/{TaskItem,TaskGroup,QuickAdd,TaskEditor,PriorityBadge,SubtaskList}.jsx
│       │   ├── calendar/{MonthGrid,DayPanel}.jsx
│       │   └── stats/{CompletionCard,Heatmap}.jsx
│       └── ui/             # shadcn/ui 生成的基础组件
```

**技术适配点:** `vite.config.js` 加
```js
resolve: { alias: { 'node:crypto': new URL('./shims/node-crypto.js', import.meta.url).pathname } }
```
`shims/node-crypto.js` 仅 `export const randomUUID = () => crypto.randomUUID();`。这是让 4 个 src 文件在浏览器运行的唯一胶水,零侵入。

---

## 5. 状态管理(`useTaskStore`)

Zustand store,`persist` 中间件写入 `localStorage`(key 为 `rixu:v1`)。

**State:** `{ tasks: Task[], lists: List[], filter: {view, listId, tag, priority}, timeZone }`

**Actions(内部调用 src 纯函数,统一处理 `{ok:false, errors}`):**
- `addTask(input)` → `createTask(input, {clock, idGenerator})` → 成功 push 进 `tasks`,失败返回 `errors`
- `editTask(id, changes)` → 找到 task → `updateTask` → 替换
- `toggleComplete(id)` → 完成前用 `checkSubtaskCompletion`(纯)拦截未完成子任务 → `updateTask` 置 `status/completedAt`
- `removeTask(id, {confirmed})` → 需确认弹窗
- `addList/renameList/removeList` → 对应 `organization.js` 纯函数
- 派生 selector:`selectTasksForView`、`selectCalendarIndex`、`selectStats` 等,直接调 `query/*`

**注入项:** `idGenerator = () => crypto.randomUUID()`;`clock = () => new Date()`;`timeZone` 从 `lib/clock.js` 取(`Intl.DateTimeFormat().resolvedOptions().timeZone`,允许用户覆盖)。

---

## 6. 页面与视觉设计

**布局:** 经典三区 App Shell(参考 Things 3 / TickTick 的干净留白)。

```
┌──────────┬──────────────────────────────────┐
│ Sidebar  │  Topbar: 视图切换 + 搜索 + 快速添加 │
│          ├──────────────────────────────────┤
│ 智能清单  │                                  │
│ ·今天    │       主内容区(列表/日历/统计)     │
│ ·未来    │                                  │
│ ·逾期🔴  │                                  │
│ ·已完成  │                                  │
│ ──────   │                                  │
│ 我的清单  │                                  │
│ 标签     │                                  │
│ 优先级   │                                  │
└──────────┴──────────────────────────────────┘
```

**视觉风格:** 浅色为主 + 暗色模式(Tailwind `dark:`);圆角卡片、柔和阴影、充足留白;优先级色点(urgent 红 / high 橙 / medium 蓝 / low 灰 / none 无);逾期任务红色高亮(用 `getOverdueTasks` 返回的 `highlightColor`/`overdueLabel`);系统字体栈,中文友好。

**页面 1 · 任务列表页(`TaskListPage`)**
- 按 `getTasksForView(tasks, view, {now, timeZone})` 分组渲染「今天/未来/逾期/已完成」。
- `TaskItem`:左侧圆形复选框(点击→`toggleComplete`)、标题、到期时间、标签 chip、优先级色点。
- 顶部 `QuickAdd`:输入框支持中文自然语言,接 `parseChineseDate` 预填 dueDate/time。
- 点击行展开 `TaskEditor`(标题/日期/时区/优先级/标签/清单/循环规则/子任务)。含 `SubtaskList`;完成父任务前用 `checkSubtaskCompletion` 拦截并提示未完成子任务。

**页面 2 · 日历页(`CalendarPage`)**
- `MonthGrid` 月视图,每格用 `buildCalendarIndex(tasks)` 显示当天任务圆点/数量;支持 月/周 切换。
- 点某天 → 右侧 `DayPanel` 用 `selectCalendarDate(tasks, date)` 列出当天任务,并提供「+ 在这天新建」(预填 `createTaskInput.dueDate`)。

**页面 3 · 侧边栏导航(`Sidebar`,常驻)**
- 智能清单(今天/未来/逾期/已完成)。
- 我的清单:`getLists`,每项显示任务数(`filterByListId(...).length`)。
- 标签云 + 优先级过滤。
- 点击即设置 store `filter`,主区用 `filterByListId/filterByTag/filterByPriority` + `sortByPriority` 过滤。

**页面 4 · 统计仪表板(`StatsPage`)**
- `CompletionCard`:区间完成率 `calculateCompletionRate(tasks, {from, to})`。
- `Heatmap`:GitHub 风格,`buildCompletionHeatmap(tasks, {from, to, timezone})`,绿色深浅表每日完成数。

---

## 7. 错误处理

- domain 返回的 `errors[{field, code, message, action}]` → 表单内联红字显示 `message`,并展示建议 `action`。
- 删除任务需显式确认:确认弹窗 → `removeTask(id, {confirmed:true})`。
- 时区/时钟统一从 `lib/clock.js` 注入 `now` 与 `timeZone`,传给所有 query 函数,保证「今天/逾期」判定一致。
- 时区转换异常(`TimeZoneConversionError`)在编辑器内捕获并提示。

---

## 8. 测试

- **工具:** Vitest + React Testing Library(与 src 现有 `node:test` 并存,互不干扰)。
- **范围:** 只测前端集成与渲染,**不重复测 src 已有充分覆盖的逻辑**。
  - 新建任务 → 出现在对应分组
  - 完成任务 → 移入「已完成」;有未完成子任务时被拦截
  - 逾期任务红色高亮
  - 日历选日 → 当天任务列出 + 快速新建预填日期
  - 侧边栏过滤联动
  - 刷新后 localStorage 数据恢复
- **可选:** 1 条 Playwright 冒烟测试覆盖主流程。

---

## 9. 交付顺序(每步可独立验收)

1. `web/` 脚手架 + `node:crypto` shim + AppShell 布局骨架(能启动、能 import src)
2. `useTaskStore` + 任务列表页(核心 CRUD 闭环)+ localStorage 持久化
3. 侧边栏导航与过滤联动
4. 日历页
5. 统计仪表板
6. 暗色模式 + 视觉打磨 + 冒烟测试

---

## 10. 开放问题 / 未来

- 后端同步里程碑:实现 `CloudAdapter`(接 `sync-coordinator`),届时从方案 A 升级到方案 B。
- 提醒(`ReminderService`)需浏览器通知权限,MVP 暂不接,列为后续。
- 循环任务的 UI 编辑器粒度(daily/weekly/monthly/custom)可迭代细化。
