import { compareVersions, resolveConflict } from './conflict-resolver.js';

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function versionFromOperation(operation) {
  return {
    ...clone(operation),
    entityType: operation.entityType ?? operation.type ?? (String(operation.operationType).includes('list') ? 'list' : 'task'),
    entityId: operation.entityId ?? operation.id ?? operation.payload?.id ?? operation.tombstone?.entityId,
    payload: operation.payload ? clone(operation.payload) : undefined,
    tombstone: operation.tombstone ? clone(operation.tombstone) : undefined,
  };
}

export class SyncCoordinator {
  #localStore;
  #queue;
  #adapter;
  #versions = new Map();
  #syncing = null;
  #cursor = null;

  constructor({ localStore, store, queue, adapter } = {}) {
    localStore ??= store;
    queue ??= localStore?.queue;
    adapter ??= queue?.adapter;
    if (!localStore) throw new TypeError('localStore is required.');
    if (!queue || typeof queue.process !== 'function') throw new TypeError('queue must provide process.');
    if (!adapter || typeof adapter.upload !== 'function') throw new TypeError('adapter must provide upload.');
    this.#localStore = localStore;
    this.#queue = queue;
    this.#adapter = adapter;
  }

  async sync() {
    if (this.#syncing) return this.#syncing;
    this.#syncing = this.#run();
    try {
      return await this.#syncing;
    } finally {
      this.#syncing = null;
    }
  }

  synchronize() {
    return this.sync();
  }

  retry() {
    return this.sync();
  }

  async #run() {
    const queueResult = await this.#queue.process();
    for (const operation of this.#queue.operations?.() ?? []) {
      const version = versionFromOperation(operation);
      const key = `${version.entityType}:${version.entityId ?? version.payload?.id ?? version.tombstone?.entityId}`;
      this.#versions.set(key, resolveConflict(this.#versions.get(key), version));
    }
    let applied = 0;
    try {
      let hasMore = typeof this.#adapter.pull === 'function';
      let pageCount = 0;
      while (hasMore) {
        if (pageCount++ >= 1_000) throw new Error('Remote pull pagination did not converge.');
        const response = await this.#adapter.pull({ accountId: this.#queue.accountId, cursor: this.#cursor });
        const remote = Array.isArray(response) ? response : response?.changes ?? response?.snapshots ?? [];
        for (const raw of remote) {
          const version = versionFromOperation(raw);
          const key = `${version.entityType}:${version.entityId}`;
          const previous = this.#versions.get(key);
          if (previous && compareVersions(previous, version) >= 0) continue;
          const winner = resolveConflict(previous, version);
          this.#versions.set(key, winner);
          const result = this.#apply(winner);
          if (result?.applied !== false) applied += 1;
        }
        if (Array.isArray(response)) {
          hasMore = false;
        } else {
          if (response?.cursor !== undefined) this.#cursor = response.cursor;
          if (response?.nextCursor !== undefined) this.#cursor = response.nextCursor;
          hasMore = response?.hasMore === true;
        }
      }
    } catch {
      return {
        ok: false,
        code: 'PULL_FAILED',
        action: 'Reconnect and retry synchronization.',
        queue: queueResult,
        applied,
        diagnostics: this.#queue.diagnostics(),
      };
    }
    const diagnostics = this.#queue.diagnostics();
    return {
      ok: !diagnostics.some((entry) => entry.status === 'failed'),
      queue: queueResult,
      applied,
      diagnostics,
    };
  }

  #apply(version) {
    return this.#localStore.applyRemoteSnapshot(version);
  }
}

export default SyncCoordinator;
