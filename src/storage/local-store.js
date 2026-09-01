function clone(value) {
  return structuredClone(value);
}

function nextVersion(updatedAt) {
  return new Date(Date.parse(updatedAt) + 1).toISOString();
}

export class LocalStore {
  #taskRepository;
  #listRepository;
  #syncQueue;

  constructor({ taskRepository, repository, listRepository = null, syncQueue, queue } = {}) {
    taskRepository ??= repository;
    syncQueue ??= queue;
    if (!taskRepository || typeof taskRepository.create !== 'function') {
      throw new TypeError('taskRepository must provide task repository methods.');
    }
    if (!syncQueue || typeof syncQueue.enqueue !== 'function') {
      throw new TypeError('syncQueue must provide enqueue.');
    }
    this.#taskRepository = taskRepository;
    if (listRepository !== null && (!listRepository || typeof listRepository.create !== 'function')) {
      throw new TypeError('listRepository must provide list repository methods.');
    }
    this.#listRepository = listRepository;
    this.#syncQueue = syncQueue;
  }

  createTask(input) {
    const result = this.#taskRepository.create(input);
    if (result.ok) this.#enqueue('create', result.task.id, result.task, result.task.updatedAt);
    return clone(result);
  }

  create(input) {
    return this.createTask(input);
  }

  updateTask(id, changes) {
    const result = this.#taskRepository.update(id, changes);
    if (result.ok && result.task) this.#enqueue('update', id, result.task, result.task.updatedAt);
    return clone(result);
  }

  update(id, changes) {
    return this.updateTask(id, changes);
  }

  completeTask(id) {
    const result = this.#taskRepository.complete(id);
    if (result.ok && result.changed !== false) this.#enqueue('complete', id, result.task, result.task.updatedAt);
    return clone(result);
  }

  complete(id) {
    return this.completeTask(id);
  }

  uncompleteTask(id) {
    const result = this.#taskRepository.uncomplete(id);
    if (result.ok && result.changed !== false) this.#enqueue('uncomplete', id, result.task, result.task.updatedAt);
    return clone(result);
  }

  uncomplete(id) {
    return this.uncompleteTask(id);
  }

  toggleTaskCompletion(id) {
    const task = this.#taskRepository.getById(id);
    if (!task) return this.completeTask(id);
    return task.status === 'completed' ? this.uncompleteTask(id) : this.completeTask(id);
  }

  deleteTask(id, options) {
    const current = this.#taskRepository.getById(id);
    const result = this.#taskRepository.delete(id, options);
    if (result.ok && result.deleted && current) {
      const deletedAt = nextVersion(current.updatedAt);
      this.#enqueue('delete', id, null, deletedAt, { deletedAt });
    }
    return clone(result);
  }

  delete(id, options) {
    return this.deleteTask(id, options);
  }

  getTask(id) {
    return this.#taskRepository.getById(id);
  }

  getById(id) {
    return this.getTask(id);
  }

  getTasks() {
    return this.#taskRepository.getAll();
  }

  getAll() {
    return this.getTasks();
  }

  createList(input) {
    this.#requireListRepository();
    const result = this.#listRepository.create(input);
    if (result.ok) this.#enqueue('create-list', result.list.id, result.list, result.list.updatedAt);
    return clone(result);
  }

  renameList(id, changes) {
    this.#requireListRepository();
    const result = this.#listRepository.rename(id, changes);
    if (result.ok) this.#enqueue('update-list', id, result.list, result.list.updatedAt);
    return clone(result);
  }

  deleteList(id, options) {
    this.#requireListRepository();
    const current = this.#listRepository.getById(id);
    const tasksBefore = new Map(
      this.#taskRepository.getAll().map((task) => [task.id, task]),
    );
    const result = this.#listRepository.delete(id, options);
    if (result.ok && result.deleted && current) {
      for (const task of this.#taskRepository.getAll()) {
        const previous = tasksBefore.get(task.id);
        if (previous && JSON.stringify(previous) !== JSON.stringify(task)) {
          this.#enqueue('update', task.id, task, task.updatedAt);
        }
      }
      const deletedAt = nextVersion(current.updatedAt);
      this.#enqueue('delete-list', id, null, deletedAt, { deletedAt });
    }
    return clone(result);
  }

  getList(id) {
    this.#requireListRepository();
    return this.#listRepository.getById(id);
  }

  getLists() {
    this.#requireListRepository();
    return this.#listRepository.getAll();
  }

  applyRemoteSnapshot(version) {
    const entityType = version?.entityType ?? (String(version?.operationType).includes('list') ? 'list' : 'task');
    if (entityType === 'list') {
      this.#requireListRepository();
      if (typeof this.#listRepository.applyRemoteSnapshot !== 'function') {
        throw new TypeError('listRepository must provide applyRemoteSnapshot.');
      }
      return clone(this.#listRepository.applyRemoteSnapshot(version));
    }
    if (typeof this.#taskRepository.applyRemoteSnapshot !== 'function') {
      throw new TypeError('taskRepository must provide applyRemoteSnapshot.');
    }
    return clone(this.#taskRepository.applyRemoteSnapshot(version));
  }

  get queue() {
    return this.#syncQueue;
  }

  #enqueue(operationType, entityId, payload, updatedAt, extra = {}) {
    this.#syncQueue.enqueue({
      entityId,
      entityType: operationType.includes('list') ? 'list' : 'task',
      operationType,
      payload: payload ? clone(payload) : undefined,
      tombstone: payload ? undefined : { entityId, ...extra },
      updatedAt,
    });
  }

  #requireListRepository() {
    if (!this.#listRepository) throw new TypeError('listRepository is required for list operations.');
  }
}
