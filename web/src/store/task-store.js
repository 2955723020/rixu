import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { createList, renameList } from '../../../src/domain/organization.js';
import { checkSubtaskCompletion, validateParentRelation } from '../../../src/domain/subtask.js';
import { createTask, updateTask } from '../../../src/domain/task.js';
import { getTimeZone } from '../lib/clock.js';

const STORAGE_KEY = 'rixu:v1';
const LEGACY_STORAGE_KEY = 'teamos:v1';
const clone = (value) => structuredClone(value);

function migrateLegacyStorage() {
  if (typeof localStorage === 'undefined') return;
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy === null) return;
  if (localStorage.getItem(STORAGE_KEY) === null) {
    localStorage.setItem(STORAGE_KEY, legacy);
  }
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

function taskNotFound(id) {
  return {
    ok: false,
    errors: [{
      field: 'id',
      code: 'NOT_FOUND',
      message: 'No task exists for this id.',
      action: 'Reload tasks and choose an existing task.',
    }],
    input: { id },
  };
}

function listNotFound(id) {
  return {
    ok: false,
    errors: [{
      field: 'id',
      code: 'NOT_FOUND',
      message: 'No list exists for this id.',
      action: 'Reload lists and choose an existing list.',
    }],
    input: { id },
  };
}

function listDeleteFailure(id, options, code, message, action) {
  return {
    ok: false,
    errors: [{ field: 'strategy', code, message, action }],
    input: { id, ...(options || {}) },
  };
}

function updateArray(items, id, next) {
  return items.map((item) => (item.id === id ? next : item));
}

export function createTaskStore({
  clock = () => new Date(),
  idGenerator = () => globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}`,
  persist: shouldPersist = true,
} = {}) {
  if (shouldPersist) migrateLegacyStorage();
  const initializer = (set, get) => ({
    tasks: [],
    lists: [],
    filter: { view: 'today', listId: null, tag: null, priority: null, search: '' },
    timeZone: getTimeZone(),
    theme: 'light',

    addTask(input) {
      if (input?.parentId !== undefined && input?.parentId !== null) {
        const relation = validateParentRelation({
          parentId: input.parentId,
          getTask: (id) => get().tasks.find((task) => task.id === id) || null,
        });
        if (!relation.ok) return { ...relation, input: clone(input) };
      }
      const result = createTask(input, { clock, idGenerator });
      if (!result.ok) return result;
      set((state) => ({ tasks: [...state.tasks, clone(result.task)] }));
      return clone(result);
    },

    editTask(id, changes) {
      const current = get().tasks.find((task) => task.id === id);
      if (!current) return taskNotFound(id);
      const result = updateTask(current, changes, { clock });
      if (!result.ok) return result;
      set((state) => ({ tasks: updateArray(state.tasks, id, clone(result.task)) }));
      return clone(result);
    },

    toggleComplete(id) {
      const current = get().tasks.find((task) => task.id === id);
      if (!current) return taskNotFound(id);
      if (current.status === 'completed') {
        const timestamped = updateTask(current, {}, { clock });
        const task = { ...timestamped.task, status: 'pending', completedAt: null };
        set((state) => ({ tasks: updateArray(state.tasks, id, task) }));
        return { ok: true, task: clone(task), changed: true };
      }
      const children = get().tasks.filter((task) => task.parentId === id);
      const guard = checkSubtaskCompletion(current, children);
      if (!guard.ok) return clone(guard);
      const timestamped = updateTask(current, {}, { clock });
      const task = {
        ...timestamped.task,
        status: 'completed',
        completedAt: new Date(clock()).toISOString(),
      };
      set((state) => ({ tasks: updateArray(state.tasks, id, task) }));
      return { ok: true, task: clone(task), changed: true };
    },

    removeTask(id, { confirmed = false } = {}) {
      if (!confirmed) {
        return {
          ok: false,
          errors: [{
            field: 'confirmation',
            code: 'CONFIRMATION_REQUIRED',
            message: 'Task deletion requires explicit confirmation.',
            action: 'Confirm deletion explicitly before retrying.',
          }],
          input: { id, confirmed },
        };
      }
      const exists = get().tasks.some((task) => task.id === id);
      if (!exists) return { ok: true, deleted: false, id };
      const deletedIds = new Set([id]);
      let foundDescendant = true;
      while (foundDescendant) {
        foundDescendant = false;
        for (const task of get().tasks) {
          if (task.parentId && deletedIds.has(task.parentId) && !deletedIds.has(task.id)) {
            deletedIds.add(task.id);
            foundDescendant = true;
          }
        }
      }
      set((state) => ({ tasks: state.tasks.filter((task) => !deletedIds.has(task.id)) }));
      return { ok: true, deleted: true, id, deletedIds: [...deletedIds] };
    },

    addList(input) {
      const result = createList(input, { clock, idGenerator });
      if (!result.ok) return result;
      set((state) => ({ lists: [...state.lists, clone(result.list)] }));
      return clone(result);
    },

    renameList(id, changes) {
      const current = get().lists.find((list) => list.id === id);
      if (!current) return listNotFound(id);
      const submitted = typeof changes === 'string' ? { name: changes } : changes;
      const result = renameList(current, submitted, { clock });
      if (!result.ok) return result;
      set((state) => ({ lists: updateArray(state.lists, id, clone(result.list)) }));
      return clone(result);
    },

    removeList(id, options = {}) {
      const current = get().lists.find((list) => list.id === id);
      if (!current) return { ok: true, deleted: false, id };
      if (!options.strategy) {
        return listDeleteFailure(id, options, 'POLICY_REQUIRED', 'List deletion requires an explicit task handling strategy.', 'Choose unassign to keep tasks without a list or move to migrate them.');
      }
      if (options.strategy !== 'unassign' && options.strategy !== 'move') {
        return listDeleteFailure(id, options, 'INVALID_POLICY', 'strategy must be unassign or move.', 'Choose unassign or move before retrying deletion.');
      }
      if (options.strategy === 'move') {
        if (!options.targetListId || options.targetListId === id) {
          return listDeleteFailure(id, options, 'SOURCE_EQUALS_TARGET', 'The move target must differ from the list being deleted.', 'Choose another existing list as targetListId.');
        }
        if (!get().lists.some((list) => list.id === options.targetListId)) {
          return listDeleteFailure(id, options, 'TARGET_NOT_FOUND', 'No target list exists for targetListId.', 'Choose an existing target list before retrying deletion.');
        }
      }
      const targetListId = options.strategy === 'move' ? options.targetListId : null;
      set((state) => ({
        lists: state.lists.filter((list) => list.id !== id),
        tasks: state.tasks.map((task) => task.listId === id ? { ...task, listId: targetListId } : task),
      }));
      return { ok: true, deleted: true, id };
    },

    setFilter(changes) {
      set((state) => ({ filter: { ...state.filter, ...changes } }));
    },

    setTimeZone(timeZone) {
      set({ timeZone });
    },

    setTheme(theme) {
      set({ theme: theme === 'dark' ? 'dark' : 'light' });
    },

    seedDemoData() {
      if (get().tasks.length > 0) return;
      const demo = [
        { title: '整理本周重点', dueDate: new Date().toISOString().slice(0, 10), priority: 'high', tags: ['规划'] },
        { title: '给团队同步进度', dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), priority: 'medium', tags: ['工作'] },
      ];
      for (const input of demo) get().addTask(input);
    },
  });

  const store = shouldPersist
    ? create(persist(initializer, {
        name: STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ tasks: state.tasks, lists: state.lists, filter: state.filter, timeZone: state.timeZone, theme: state.theme }),
      }))
    : create(initializer);
  return store;
}

export const useTaskStore = createTaskStore();
export { STORAGE_KEY };
