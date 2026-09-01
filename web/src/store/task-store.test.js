import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTaskStore } from './task-store.js';

describe('task store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates tasks and projects completion into completed views', () => {
    const store = createTaskStore({
      clock: () => new Date('2026-08-31T01:00:00.000Z'),
      idGenerator: () => 'task-1',
      persist: false,
    });

    const result = store.getState().addTask({ title: '准备周会', dueDate: '2026-09-01' });
    expect(result.ok).toBe(true);
    expect(store.getState().tasks).toHaveLength(1);
    expect(store.getState().toggleComplete('task-1').ok).toBe(true);
    expect(store.getState().tasks[0].status).toBe('completed');
  });

  it('blocks completing a parent while direct children remain pending', () => {
    let nextId = 0;
    const store = createTaskStore({
      clock: () => new Date('2026-08-31T01:00:00.000Z'),
      idGenerator: () => `task-${++nextId}`,
      persist: false,
    });
    const parent = store.getState().addTask({ title: '发布版本', dueDate: '2026-09-10' });
    store.getState().addTask({ title: '整理变更记录', dueDate: '2026-09-09', parentId: parent.task.id });

    const result = store.getState().toggleComplete(parent.task.id);
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('INCOMPLETE_SUBTASKS');
  });

  it('rejects a child whose parent does not exist', () => {
    const store = createTaskStore({
      clock: () => new Date('2026-08-31T01:00:00.000Z'),
      idGenerator: () => 'task-1',
      persist: false,
    });

    const result = store.getState().addTask({ title: '孤立子任务', dueDate: '2026-09-01', parentId: 'missing' });
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('PARENT_NOT_FOUND');
    expect(store.getState().tasks).toHaveLength(0);
  });

  it('deletes every descendant when a parent task is confirmed for deletion', () => {
    let nextId = 0;
    const store = createTaskStore({ idGenerator: () => `task-${++nextId}`, persist: false });
    const parent = store.getState().addTask({ title: '父任务', dueDate: '2026-09-01' });
    const child = store.getState().addTask({ title: '子任务', dueDate: '2026-09-01', parentId: parent.task.id });
    store.getState().addTask({ title: '孙任务', dueDate: '2026-09-01', parentId: child.task.id });

    store.getState().removeTask(parent.task.id, { confirmed: true });

    expect(store.getState().tasks).toEqual([]);
  });

  it('requires an explicit list deletion strategy and can unassign tasks', () => {
    const store = createTaskStore({
      clock: () => new Date('2026-08-31T01:00:00.000Z'),
      idGenerator: vi.fn()
        .mockReturnValueOnce('list-1')
        .mockReturnValueOnce('task-1'),
      persist: false,
    });
    const list = store.getState().addList({ name: '工作' });
    store.getState().addTask({ title: '任务', dueDate: '2026-09-01', listId: list.list.id });

    expect(store.getState().removeList(list.list.id).ok).toBe(false);
    expect(store.getState().removeList(list.list.id, { strategy: 'unassign' }).ok).toBe(true);
    expect(store.getState().tasks[0].listId).toBe(null);
  });

  it('rehydrates persisted tasks in a new store instance', () => {
    const first = createTaskStore({
      clock: () => new Date('2026-08-31T01:00:00.000Z'),
      idGenerator: () => 'task-1',
      persist: true,
    });
    first.getState().addTask({ title: '持久化任务', dueDate: '2026-09-01' });

    const second = createTaskStore({ persist: true });
    expect(second.getState().tasks[0].title).toBe('持久化任务');
  });

  it('migrates persisted TeamOS data to the Rixu storage key', () => {
    localStorage.setItem('teamos:v1', JSON.stringify({
      state: {
        tasks: [{ title: '改名前的任务' }],
        lists: [],
        filter: { view: 'today', listId: null, tag: null, priority: null, search: '' },
        timeZone: 'Asia/Shanghai',
        theme: 'light',
      },
      version: 0,
    }));

    const store = createTaskStore({ persist: true });

    expect(store.getState().tasks[0].title).toBe('改名前的任务');
    expect(localStorage.getItem('rixu:v1')).not.toBeNull();
    expect(localStorage.getItem('teamos:v1')).toBeNull();
  });
});
