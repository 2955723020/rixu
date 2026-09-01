function clone(value) {
  return structuredClone(value);
}

function timestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError(`${name} must be a valid date or timestamp.`);
  }
  return date.toISOString();
}

function stableKey(operation) {
  return [
    operation.accountId,
    operation.deviceId,
    operation.entityId,
    operation.operationType,
    operation.updatedAt,
  ].map((part) => encodeURIComponent(String(part))).join(':');
}

function validateOperation(operation) {
  if (!operation || typeof operation !== 'object') {
    throw new TypeError('operation must be an object.');
  }
  for (const field of ['accountId', 'deviceId', 'entityId', 'operationType', 'updatedAt']) {
    if (operation[field] === undefined || operation[field] === null || operation[field] === '') {
      throw new TypeError(`operation.${field} is required.`);
    }
  }
}

export class SyncQueue {
  #accountId;
  #deviceId;
  #adapter;
  #clock;
  #autoProcess;
  #entries = new Map();
  #processing = null;

  constructor({ accountId, deviceId, adapter, clock = () => new Date(), autoProcess = false } = {}) {
    if (accountId === undefined || accountId === null || accountId === '') {
      throw new TypeError('accountId is required.');
    }
    if (deviceId === undefined || deviceId === null || deviceId === '') {
      throw new TypeError('deviceId is required.');
    }
    if (!adapter || typeof adapter.upload !== 'function') {
      throw new TypeError('adapter must provide an upload method.');
    }
    if (typeof clock !== 'function') {
      throw new TypeError('clock must be a function.');
    }
    this.#accountId = accountId;
    this.#deviceId = deviceId;
    this.#adapter = adapter;
    this.#clock = clock;
    this.#autoProcess = autoProcess === true;
  }

  enqueue(input) {
    if (!input || input.updatedAt === undefined || input.updatedAt === null) {
      throw new TypeError('operation.updatedAt is required.');
    }
    const operation = {
      ...clone(input),
      accountId: input.accountId ?? this.#accountId,
      deviceId: input.deviceId ?? this.#deviceId,
      updatedAt: timestamp(input.updatedAt, 'operation.updatedAt'),
    };
    validateOperation(operation);
    const idempotencyKey = input.idempotencyKey ?? stableKey(operation);
    const existing = this.#entries.get(idempotencyKey);
    if (existing) {
      return clone(existing.operation);
    }

    const queuedOperation = { ...operation, idempotencyKey };
    const entry = {
      operation: queuedOperation,
      status: 'pending',
      retryable: true,
      attempts: 0,
      createdAt: timestamp(this.#clock(), 'clock'),
      updatedAt: timestamp(this.#clock(), 'clock'),
      lastError: null,
      idempotencyKey,
    };
    this.#entries.set(idempotencyKey, entry);
    if (this.#autoProcess) {
      void this.process();
    }
    return clone(queuedOperation);
  }

  async process() {
    if (this.#processing) {
      return this.#processing;
    }
    this.#processing = (async () => {
      for (const entry of this.#entries.values()) {
        if (entry.status !== 'pending' && entry.status !== 'failed') continue;
        await this.#submit(entry);
      }
      return this.diagnostics();
    })();
    try {
      return await this.#processing;
    } finally {
      this.#processing = null;
    }
  }

  async processPending() {
    return this.process();
  }

  async retry(idempotencyKey) {
    if (idempotencyKey !== undefined) {
      const entry = this.#entries.get(idempotencyKey);
      if (!entry) return null;
      if (entry.status === 'succeeded') return this.#diagnostic(entry);
      entry.status = 'pending';
      entry.retryable = true;
    }
    await this.process();
    return idempotencyKey === undefined
      ? this.diagnostics()
      : this.#diagnostic(this.#entries.get(idempotencyKey));
  }

  async retryAll() {
    return this.retry();
  }

  get size() {
    return this.#entries.size;
  }

  get accountId() {
    return this.#accountId;
  }

  get deviceId() {
    return this.#deviceId;
  }

  get adapter() {
    return this.#adapter;
  }

  operations() {
    return Array.from(this.#entries.values(), (entry) => clone(entry.operation));
  }

  diagnostics() {
    return Array.from(this.#entries.values(), (entry) => this.#diagnostic(entry));
  }

  getDiagnostics() {
    return this.diagnostics();
  }

  serializeDiagnostics() {
    return JSON.stringify(this.diagnostics());
  }

  #diagnostic(entry) {
    if (!entry) return null;
    return {
      idempotencyKey: entry.idempotencyKey,
      accountId: entry.operation.accountId,
      deviceId: entry.operation.deviceId,
      entityId: entry.operation.entityId,
      operationType: entry.operation.operationType,
      updatedAt: entry.operation.updatedAt,
      status: entry.status,
      pending: entry.status === 'pending',
      retryable: entry.retryable,
      attempts: entry.attempts,
      createdAt: entry.createdAt,
      updatedAtDiagnostic: entry.updatedAt,
      lastError: entry.lastError,
      action: entry.status === 'failed'
        ? 'Reconnect and retry the pending synchronization operation.'
        : null,
    };
  }

  async #submit(entry) {
    entry.attempts += 1;
    entry.updatedAt = timestamp(this.#clock(), 'clock');
    try {
      await this.#adapter.upload(clone(entry.operation));
      entry.status = 'succeeded';
      entry.retryable = false;
      entry.lastError = null;
    } catch (error) {
      entry.status = 'failed';
      entry.retryable = true;
      entry.lastError = { code: 'UPLOAD_FAILED', message: 'Cloud upload failed.' };
    }
    entry.updatedAt = timestamp(this.#clock(), 'clock');
  }
}
