import { randomUUID } from 'node:crypto';

import { createTask, updateTask } from '../domain/task.js';
import {
  checkSubtaskCompletion,
  validateParentRelation,
} from '../domain/subtask.js';
import { compareVersions } from '../sync/conflict-resolver.js';

function clone(value) {
  return structuredClone(value);
}

function isValidTag(tag) {
  return typeof tag === 'string' && tag.trim().length > 0;
}

function invalidTagResult(tag) {
  return {
    ok: false,
    errors: [
      {
        field: 'tags',
        code: 'INVALID_TAGS',
        message: 'tags must contain unique, non-empty strings.',
        action: 'Provide a non-empty tag and remove duplicate tags before retrying.',
      },
    ],
    input: { tag },
  };
}

function notFoundResult(id, input) {
  return {
    ok: false,
    errors: [
      {
        field: 'id',
        code: 'NOT_FOUND',
        message: 'No task exists for this id.',
        action: 'Reload tasks and choose an existing task.',
      },
    ],
    input: clone(input),
  };
}

export class TaskRepository {
  #clock;
  #idGenerator;
  #tasks = new Map();
  #remoteVersions = new Map();
  #issuedIds = new Set();

  constructor({ clock = () => new Date(), idGenerator = randomUUID } = {}) {
    if (typeof clock !== 'function') {
      throw new TypeError('clock must be a function.');
    }
    if (typeof idGenerator !== 'function') {
      throw new TypeError('idGenerator must be a function.');
    }
    this.#clock = clock;
    this.#idGenerator = idGenerator;
  }

  create(input) {
    const submitted = input && typeof input === 'object' ? input : {};
    if (submitted.parentId !== undefined && submitted.parentId !== null) {
      const relation = validateParentRelation({
        parentId: submitted.parentId,
        getTask: (id) => this.#tasks.get(id) ?? null,
      });
      if (!relation.ok) {
        return { ...relation, input: clone(submitted) };
      }
    }

    const result = createTask(input, {
      clock: this.#clock,
      idGenerator: () => this.#nextUniqueId(),
    });

    if (!result.ok) {
      return result;
    }

    const relation = validateParentRelation({
      taskId: result.task.id,
      parentId: result.task.parentId,
      getTask: (id) => this.#tasks.get(id) ?? null,
    });
    if (!relation.ok) {
      return { ...relation, input: clone(submitted) };
    }

    this.#tasks.set(result.task.id, clone(result.task));
    return { ok: true, task: clone(result.task) };
  }

  createSubtask(parentId, input) {
    const submitted = input && typeof input === 'object' ? input : {};
    if (
      Object.prototype.hasOwnProperty.call(submitted, 'parentId') &&
      submitted.parentId !== parentId
    ) {
      return {
        ok: false,
        errors: [
          {
            field: 'parentId',
            code: 'PARENT_MISMATCH',
            message: 'The child input parentId must match the requested parent.',
            action: 'Remove parentId from the child input or set it to the requested parent ID.',
          },
        ],
        input: clone(submitted),
      };
    }
    if (parentId === undefined || parentId === null || !this.#tasks.has(parentId)) {
      if (parentId === undefined || parentId === null) {
        return {
          ok: false,
          errors: [
            {
              field: 'parentId',
              code: 'PARENT_NOT_FOUND',
              message: 'parentId must reference an existing task.',
              action: 'Choose an existing task as parentId before retrying.',
            },
          ],
          input: clone({ ...submitted, parentId }),
        };
      }
      const relation = validateParentRelation({
        parentId,
        getTask: (id) => this.#tasks.get(id) ?? null,
      });
      return { ...relation, input: clone({ ...submitted, parentId }) };
    }

    return this.create({ ...submitted, parentId });
  }

  addSubtask(parentId, input) {
    return this.createSubtask(parentId, input);
  }

  createChild(parentId, input) {
    return this.createSubtask(parentId, input);
  }

  getById(id) {
    const task = this.#tasks.get(id);
    return task ? clone(task) : null;
  }

  getAll() {
    return Array.from(this.#tasks.values(), (task) => clone(task));
  }

  getChildren(parentId) {
    return Array.from(this.#tasks.values())
      .filter((task) => task.parentId === parentId)
      .map((task) => clone(task));
  }

  getSubtasks(parentId) {
    return this.getChildren(parentId);
  }

  getDirectChildren(parentId) {
    return this.getChildren(parentId);
  }

  getSubtasksByParentId(parentId) {
    return this.getChildren(parentId);
  }

  getParent(childId) {
    const child = this.#tasks.get(childId);
    if (!child || child.parentId === null || child.parentId === undefined) {
      return null;
    }
    const parent = this.#tasks.get(child.parentId);
    return parent ? clone(parent) : null;
  }

  getParentTask(childId) {
    return this.getParent(childId);
  }

  checkCompletion(taskId) {
    const task = this.#tasks.get(taskId);
    if (!task) {
      return notFoundResult(taskId, { id: taskId });
    }
    return checkSubtaskCompletion(task, this.getChildren(taskId));
  }

  canComplete(taskId) {
    return this.checkCompletion(taskId);
  }

  checkBeforeComplete(taskId) {
    return this.checkCompletion(taskId);
  }

  checkCompletionGuard(taskId) {
    return this.checkCompletion(taskId);
  }

  checkParentCompletion(taskId) {
    return this.checkCompletion(taskId);
  }

  canCompleteTask(taskId) {
    return this.checkCompletion(taskId);
  }

  complete(id) {
    const current = this.#tasks.get(id);
    if (!current) {
      return notFoundResult(id, { id });
    }
    if (current.status === 'completed') {
      return { ok: true, task: clone(current), changed: false };
    }

    const guard = this.checkCompletion(id);
    if (!guard.ok) {
      return guard;
    }
    const completedAt = new Date(this.#clock()).toISOString();
    const updatedAt = new Date(
      Math.max(Date.parse(completedAt), Date.parse(current.updatedAt) + 1),
    ).toISOString();
    const task = {
      ...clone(current),
      status: 'completed',
      completedAt,
      updatedAt,
    };
    this.#tasks.set(id, clone(task));
    return { ok: true, task: clone(task), changed: true };
  }

  markComplete(id) {
    return this.complete(id);
  }

  uncomplete(id) {
    const current = this.#tasks.get(id);
    if (!current) {
      return notFoundResult(id, { id });
    }
    if (current.status !== 'completed') {
      return { ok: true, task: clone(current), changed: false };
    }

    const now = new Date(this.#clock()).toISOString();
    const updatedAt = new Date(
      Math.max(Date.parse(now), Date.parse(current.updatedAt) + 1),
    ).toISOString();
    const task = {
      ...clone(current),
      status: 'pending',
      completedAt: null,
      updatedAt,
    };
    this.#tasks.set(id, clone(task));
    return { ok: true, task: clone(task), changed: true };
  }

  reopen(id) {
    return this.uncomplete(id);
  }

  reparent(taskId, parentId) {
    return this.update(taskId, { parentId });
  }

  setParent(taskId, parentId) {
    return this.reparent(taskId, parentId);
  }

  update(id, changes) {
    const current = this.#tasks.get(id);
    if (!current) {
      return notFoundResult(id, changes && typeof changes === 'object' ? changes : {});
    }

    if (
      changes &&
      typeof changes === 'object' &&
      Object.prototype.hasOwnProperty.call(changes, 'parentId') &&
      changes.parentId !== current.parentId
    ) {
      const relation = validateParentRelation({
        taskId: id,
        parentId: changes.parentId,
        getTask: (taskId) => this.#tasks.get(taskId) ?? null,
      });
      if (!relation.ok) {
        return { ...relation, input: clone(changes) };
      }
    }

    const result = updateTask(current, changes, { clock: this.#clock });
    if (!result.ok) {
      return result;
    }

    this.#tasks.set(id, clone(result.task));
    return { ok: true, task: clone(result.task) };
  }

  addTag(id, tag) {
    const current = this.#tasks.get(id);
    if (!current) {
      return notFoundResult(id, { tag });
    }
    if (!isValidTag(tag)) {
      return invalidTagResult(tag);
    }

    const tags = Array.isArray(current.tags) ? current.tags : [];
    if (tags.includes(tag)) {
      return { ok: true, task: clone(current) };
    }

    return this.update(id, { tags: [...tags, tag] });
  }

  removeTag(id, tag) {
    const current = this.#tasks.get(id);
    if (!current) {
      return notFoundResult(id, { tag });
    }
    if (!isValidTag(tag)) {
      return invalidTagResult(tag);
    }

    const tags = Array.isArray(current.tags) ? current.tags : [];
    if (!tags.includes(tag)) {
      return { ok: true, task: clone(current) };
    }

    return this.update(id, { tags: tags.filter((value) => value !== tag) });
  }

  reassignList(sourceListId, targetListId) {
    if (sourceListId === targetListId) {
      return { ok: true, updated: 0 };
    }

    const updates = [];
    for (const [id, current] of this.#tasks) {
      if (current.listId !== sourceListId) {
        continue;
      }

      const result = updateTask(
        current,
        { listId: targetListId ?? null },
        { clock: this.#clock },
      );
      if (!result.ok) {
        return result;
      }
      updates.push([id, result.task]);
    }

    for (const [id, task] of updates) {
      this.#tasks.set(id, clone(task));
    }
    return { ok: true, updated: updates.length };
  }

  delete(id, { confirmed = false } = {}) {
    if (confirmed !== true) {
      return {
        ok: false,
        errors: [
          {
            field: 'confirmation',
            code: 'CONFIRMATION_REQUIRED',
            message: 'Task deletion requires explicit confirmation.',
            action: 'Confirm deletion explicitly before retrying.',
          },
        ],
        input: { id, confirmed },
      };
    }

    const deleted = this.#tasks.delete(id);
    return { ok: true, deleted, id };
  }

  applyRemoteSnapshot(version) {
    const id = version?.entityId ?? version?.payload?.id ?? version?.tombstone?.entityId;
    if (id === undefined || id === null) return { ok: false, applied: false };
    const currentVersion = this.#remoteVersions.get(id);
    if (currentVersion && compareVersions(version, currentVersion) <= 0) return { ok: true, applied: false };
    this.#remoteVersions.set(id, clone(version));
    this.#issuedIds.add(id);
    if (version.tombstone || version.operationType === 'delete') {
      this.#tasks.delete(id);
      return { ok: true, applied: true, deleted: true, id };
    }
    this.#tasks.set(id, clone(version.payload));
    return { ok: true, applied: true, task: clone(version.payload) };
  }

  #nextUniqueId() {
    for (let attempt = 0; attempt < 1_000; attempt += 1) {
      const id = this.#idGenerator();
      if ((typeof id === 'string' || typeof id === 'number') && !this.#issuedIds.has(id)) {
        this.#issuedIds.add(id);
        return id;
      }
    }
    throw new Error('Unable to generate a unique task ID after 1000 attempts.');
  }
}
