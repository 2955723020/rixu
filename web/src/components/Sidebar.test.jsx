import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import App from '../App.jsx';
import { createTaskStore } from '../store/task-store.js';

function seededStore() {
  let nextId = 0;
  const store = createTaskStore({
    clock: () => new Date('2026-08-31T08:00:00.000Z'),
    idGenerator: () => `id-${++nextId}`,
    persist: false,
  });
  const work = store.getState().addList({ name: '工作' });
  store.getState().addTask({ title: '工作报告', dueDate: '2026-08-31', listId: work.list.id, tags: ['深度'], priority: 'high' });
  store.getState().addTask({ title: '买牛奶', dueDate: '2026-08-31', tags: ['生活'], priority: 'low' });
  store.getState().addTask({ title: '未来工作计划', dueDate: '2026-09-03', listId: work.list.id, tags: ['深度'], priority: 'high' });
  return store;
}

describe('sidebar filtering', () => {
  it('filters the task list by list, tag, priority and search', async () => {
    const user = userEvent.setup();
    const store = seededStore();
    render(<App storeHook={store} now="2026-08-31T08:00:00.000Z" />);

    expect(screen.getByText('工作报告')).toBeInTheDocument();
    expect(screen.getByText('买牛奶')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清单 工作' }));
    expect(screen.getByText('工作报告')).toBeInTheDocument();
    expect(screen.getByText('未来工作计划')).toBeInTheDocument();
    expect(screen.queryByText('买牛奶')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '今天' }));
    await user.click(screen.getByRole('button', { name: '标签 生活' }));
    expect(screen.getByText('买牛奶')).toBeInTheDocument();
    expect(screen.queryByText('工作报告')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '优先级 高' }));
    expect(screen.getByText('工作报告')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: '搜索任务' }), '牛奶');
    expect(screen.getByText('买牛奶')).toBeInTheDocument();
    expect(screen.queryByText('工作报告')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: '搜索任务' }));
    await user.type(screen.getByRole('searchbox', { name: '搜索任务' }), '未来工作');
    expect(screen.getByText('未来工作计划')).toBeInTheDocument();
  });
});
