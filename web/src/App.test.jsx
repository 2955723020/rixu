import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import App from './App.jsx';
import { createFocusStore } from './focus/focus-store.js';
import { createTaskStore } from './store/task-store.js';

describe('App shell', () => {
  it('gives users direct access to the primary task views', () => {
    render(<App />);

    expect(screen.getByText('日序')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '今天' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '未来' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '逾期' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '已完成' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '日历' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '统计' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '专注统计' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始专注' })).toBeInTheDocument();
  });

  it('lets the user override the timezone used by date-sensitive views', async () => {
    const user = userEvent.setup();
    const store = createTaskStore({ persist: false });
    render(<App storeHook={store} />);

    await user.selectOptions(screen.getByLabelText('用户时区'), 'UTC');

    expect(store.getState().timeZone).toBe('UTC');
  });

  it('starts focus from the topbar or preselects a task from its row', async () => {
    const user = userEvent.setup();
    const taskStore = createTaskStore({ idGenerator: () => 'task-1', persist: false });
    const focusStore = createFocusStore({ idGenerator: () => 'session-1', persist: false });
    taskStore.getState().addTask({ title: '写方案', dueDate: '2026-08-31' });
    render(<App storeHook={taskStore} focusStoreHook={focusStore} now="2026-08-31T08:00:00.000Z" />);

    await user.click(screen.getByRole('button', { name: '专注“写方案”' }));
    expect(screen.getByLabelText('关联任务')).toHaveValue('task-1');
    await user.click(within(screen.getByRole('dialog', { name: '开始一段专注' })).getByRole('button', { name: '开始专注' }));

    expect(focusStore.getState().activeSession).toMatchObject({ taskId: 'task-1', subjectSnapshot: '写方案' });
  });

  it('returns focus to the entry button when setup is cancelled', async () => {
    const user = userEvent.setup();
    const taskStore = createTaskStore({ persist: false });
    const focusStore = createFocusStore({ persist: false });
    render(<App storeHook={taskStore} focusStoreHook={focusStore} />);
    const trigger = screen.getByRole('button', { name: '开始专注' });

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: '关闭专注设置' }));

    expect(trigger).toHaveFocus();
  });
});
