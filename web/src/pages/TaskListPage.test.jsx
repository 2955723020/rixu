import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createTaskStore } from '../store/task-store.js';
import TaskListPage from './TaskListPage.jsx';

function makeStore() {
  let nextId = 0;
  return createTaskStore({
    clock: () => new Date('2026-08-31T08:00:00.000Z'),
    idGenerator: () => `task-${++nextId}`,
    persist: false,
  });
}

describe('TaskListPage', () => {
  it('quick-adds a task from Chinese date input and shows the parsed date', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.getState().setFilter({ view: 'future' });
    render(<TaskListPage storeHook={store} now="2026-08-31T08:00:00.000Z" />);

    await user.type(screen.getByPlaceholderText('输入任务，例如：明天下午3点 评审方案'), '明天下午3点 评审方案');
    expect(screen.getByText('已识别：9月1日 15:00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '添加任务' }));

    expect(screen.getByText('评审方案')).toBeInTheDocument();
    expect(store.getState().tasks[0].dueDate).toBe('2026-09-01');
  });

  it('shows the domain guard when completing a parent with pending children', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    const parent = store.getState().addTask({ title: '发布版本', dueDate: '2026-08-31' });
    store.getState().addTask({ title: '整理变更记录', dueDate: '2026-08-31', parentId: parent.task.id });
    render(<TaskListPage storeHook={store} now="2026-08-31T08:00:00.000Z" />);

    await user.click(screen.getByRole('checkbox', { name: '完成“发布版本”' }));
    expect(screen.getByText('请先完成 1 个子任务')).toBeInTheDocument();
    expect(store.getState().tasks[0].status).toBe('pending');
  });

  it('requires confirmation before removing a task', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.getState().addTask({ title: '可删除任务', dueDate: '2026-08-31' });
    render(<TaskListPage storeHook={store} now="2026-08-31T08:00:00.000Z" />);

    await user.click(screen.getByRole('button', { name: '编辑“可删除任务”' }));
    await user.click(screen.getByRole('button', { name: '删除任务' }));
    expect(screen.getByRole('dialog', { name: '确认删除' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认删除' }));

    expect(screen.queryByText('可删除任务')).not.toBeInTheDocument();
  });

  it('adds a subtask and saves a weekly recurrence rule from the editor', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    store.getState().addTask({ title: '周期任务', dueDate: '2026-08-31' });
    render(<TaskListPage storeHook={store} now="2026-08-31T08:00:00.000Z" />);

    await user.click(screen.getByRole('button', { name: '编辑“周期任务”' }));
    await user.selectOptions(screen.getByLabelText('重复规则'), 'weekly');
    await user.type(screen.getByLabelText('新子任务标题'), '第一步');
    await user.click(screen.getByRole('button', { name: '添加子任务' }));
    await user.click(screen.getByRole('button', { name: '保存更改' }));

    expect(store.getState().tasks[0].recurrence).toEqual({ frequency: 'weekly', weekdays: [1] });
    expect(store.getState().tasks.some((task) => task.title === '第一步' && task.parentId === 'task-1')).toBe(true);
  });

  it('forwards a task row focus command without opening the editor', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    const task = store.getState().addTask({ title: '专注任务', dueDate: '2026-08-31' }).task;
    let focusedTask = null;
    render(<TaskListPage storeHook={store} now="2026-08-31T08:00:00.000Z" onFocusTask={(value) => { focusedTask = value; }} />);

    await user.click(screen.getByRole('button', { name: '专注“专注任务”' }));

    expect(focusedTask).toEqual(task);
    expect(screen.queryByRole('dialog', { name: '编辑任务' })).not.toBeInTheDocument();
  });
});
