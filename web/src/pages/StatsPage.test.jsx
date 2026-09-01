import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createTaskStore } from '../store/task-store.js';
import StatsPage from './StatsPage.jsx';

describe('StatsPage', () => {
  it('shows completion rate and local-date heatmap activity', () => {
    let nextId = 0;
    const store = createTaskStore({ clock: () => new Date('2026-08-31T08:00:00.000Z'), idGenerator: () => `task-${++nextId}`, persist: false });
    const done = store.getState().addTask({ title: '已完成', dueDate: '2026-08-31' });
    store.getState().addTask({ title: '待完成', dueDate: '2026-08-31' });
    store.getState().toggleComplete(done.task.id);

    render(<StatsPage storeHook={store} now="2026-08-31T08:00:00.000Z" />);
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByLabelText('2026-08-31 完成 1 项')).toBeInTheDocument();
  });

  it('includes the local current day when UTC is still on the previous date', () => {
    const store = createTaskStore({
      clock: () => new Date('2026-08-31T16:30:00.000Z'),
      idGenerator: () => 'task-local-day',
      persist: false,
    });
    store.getState().setTimeZone('Asia/Shanghai');
    store.getState().addTask({ title: '本地今天完成', dueDate: '2026-09-01', timezone: 'Asia/Shanghai' });
    store.getState().toggleComplete('task-local-day');

    render(<StatsPage storeHook={store} now="2026-08-31T16:30:00.000Z" />);

    expect(screen.getByLabelText('2026-09-01 完成 1 项')).toBeInTheDocument();
  });
});
