import { randomUUID } from 'node:crypto';

import { createList, renameList } from '../domain/organization.js';
import { compareVersions } from '../sync/conflict-resolver.js';
import { TaskRepository } from './task-repository.js';

function clone(value) {
  return structuredClone(value);
}

function failure(field, code, message, action, input) {
  return {
    ok: false,
    errors: [{ field, code, message, action }],
    input: clone(input),
  };
}

function notFoundResult(id, input) {
  return failure(
    'id',
    'NOT_FOUND',
    'No list exists for this id.',
    'Reload lists and choose an existing list.',
    input,
  );
}

export class ListRepository {
  #clock;
  #idGenerator;
  #taskRepository;
  #lists = new Map();
  #issuedIds = new Set();
  #remoteVersions = new Map();

  constructor({
    clock = () => new Date(),
    idGenerator = randomUUID,
    taskRepository = new TaskRepository({ clock }),
  } = {}) {
    if (typeof clock !== 'function') {
      throw new TypeError('clock must be a function.');
    }
    if (typeof idGenerator !== 'function') {
      throw new TypeError('idGenerator must be a function.');
    }
    if (
      !taskRepository ||
      typeof taskRepository.reassignList !== 'function'
    ) {
      throw new TypeError('taskRepository must provide a reassignList method.');
    }
    this.#clock = clock;
    this.#idGenerator = idGenerator;
    this.#taskRepository = taskRepository;
  }

  create(input) {
    const result = createList(input, {
      clock: this.#clock,
      idGenerator: () => this.#nextUniqueId(),
    });
    if (!result.ok) {
      return result;
    }

    this.#lists.set(result.list.id, clone(result.list));
    return { ok: true, list: clone(result.list) };
  }

  getById(id) {
    const list = this.#lists.get(id);
    return list ? clone(list) : null;
  }

  getAll() {
    return Array.from(this.#lists.values(), (list) => clone(list));
  }

  rename(id, nameOrChanges) {
    const current = this.#lists.get(id);
    const changes =
      typeof nameOrChanges === 'string' ? { name: nameOrChanges } : nameOrChanges ?? {};
    if (!current) {
      return notFoundResult(id, changes);
    }

    const result = renameList(current, changes, { clock: this.#clock });
    if (!result.ok) {
      return result;
    }

    this.#lists.set(id, clone(result.list));
    return { ok: true, list: clone(result.list) };
  }

  delete(id, options = {}) {
    if (!this.#lists.has(id)) {
      return { ok: true, deleted: false, id };
    }

    const submitted = options && typeof options === 'object' ? options : {};
    const input = { id, ...submitted };
    if (submitted.strategy === undefined || submitted.strategy === null) {
      return failure(
        'strategy',
        'POLICY_REQUIRED',
        'List deletion requires an explicit task handling strategy.',
        'Choose unassign to keep tasks without a list or move to migrate them.',
        input,
      );
    }
    if (submitted.strategy !== 'unassign' && submitted.strategy !== 'move') {
      return failure(
        'strategy',
        'INVALID_POLICY',
        'strategy must be unassign or move.',
        'Choose unassign or move before retrying deletion.',
        input,
      );
    }

    let targetListId = null;
    if (submitted.strategy === 'move') {
      targetListId = submitted.targetListId;
      if (targetListId === id) {
        return failure(
          'targetListId',
          'SOURCE_EQUALS_TARGET',
          'The move target must differ from the list being deleted.',
          'Choose another existing list as targetListId.',
          input,
        );
      }
      if (!this.#lists.has(targetListId)) {
        return failure(
          'targetListId',
          'TARGET_NOT_FOUND',
          'No target list exists for targetListId.',
          'Choose an existing target list before retrying deletion.',
          input,
        );
      }
    }

    const reassigned = this.#taskRepository.reassignList(id, targetListId);
    if (!reassigned.ok) {
      return reassigned;
    }

    this.#lists.delete(id);
    return { ok: true, deleted: true, id };
  }

  applyRemoteSnapshot(version) {
    const id = version?.entityId ?? version?.payload?.id ?? version?.tombstone?.entityId;
    if (id === undefined || id === null) return { ok: false, applied: false };
    const currentVersion = this.#remoteVersions.get(id);
    if (currentVersion && compareVersions(version, currentVersion) <= 0) return { ok: true, applied: false };
    this.#remoteVersions.set(id, clone(version));
    this.#issuedIds.add(id);
    if (version.tombstone || version.operationType === 'delete-list') {
      this.#lists.delete(id);
      return { ok: true, applied: true, deleted: true, id };
    }
    this.#lists.set(id, clone(version.payload));
    return { ok: true, applied: true, list: clone(version.payload) };
  }

  #nextUniqueId() {
    for (let attempt = 0; attempt < 1_000; attempt += 1) {
      const id = this.#idGenerator();
      if ((typeof id === 'string' || typeof id === 'number') && !this.#issuedIds.has(id)) {
        this.#issuedIds.add(id);
        return id;
      }
    }
    throw new Error('Unable to generate a unique list ID after 1000 attempts.');
  }
}
