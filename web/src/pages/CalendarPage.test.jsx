import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createTaskStore } from '../store/task-store.js';
import CalendarPage from './CalendarPage.jsx';

describe('CalendarPage', () => {
  it('selects a day and creates a task with that date prefilled', async () => {
    const user = userEvent.setup();
    let nextId = 0;
    const store = createTaskStore({ clock: () => new Date('2026-08-31T08:00:00.000Z'), idGenerator: () => `task-${++nextId}`, persist: false });
    store.getState().addTask({ title: '九月计划', dueDate: '2026-09-03' });
    render(<CalendarPage storeHook={store} initialMonth="2026-09" now="2026-08-31T08:00:00.000Z" />);

    await user.click(screen.getByRole('button', { name: '选择 2026-09-03' }));
    expect(screen.getByText('九月计划')).toBeInTheDocument();
    await user.type(screen.getByLabelText('在 2026-09-03 新建任务'), '补充材料');
    await user.click(screen.getByRole('button', { name: '添加到 2026-09-03' }));

    expect(store.getState().tasks.some((task) => task.title === '补充材料' && task.dueDate === '2026-09-03')).toBe(true);
  });

  it('switches between month and week views and pages one week at a time', async () => {
    const user = userEvent.setup();
    const store = createTaskStore({ persist: false });
    render(<CalendarPage storeHook={store} initialMonth="2026-09" now="2026-09-03T08:00:00.000Z" />);

    await user.click(screen.getByRole('button', { name: '周视图' }));

    expect(screen.getByRole('grid', { name: '2026年9月周日历' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /选择 2026-/ })).toHaveLength(7);

    await user.click(screen.getByRole('button', { name: '下一周' }));
    expect(screen.getByRole('button', { name: '选择 2026-09-08' })).toBeInTheDocument();
  });

  it('opens the month containing today in the configured timezone', () => {
    const store = createTaskStore({ persist: false });
    store.getState().setTimeZone('Asia/Shanghai');

    render(<CalendarPage storeHook={store} now="2026-08-31T16:30:00.000Z" />);

    expect(screen.getByRole('heading', { name: '2026年 9月' })).toBeInTheDocument();
  });
});
