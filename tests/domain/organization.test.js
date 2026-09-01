import assert from 'node:assert/strict';
import test from 'node:test';

import { createList, renameList } from '../../src/domain/organization.js';

const dependencies = {
  clock: () => new Date('2025-01-10T08:00:00.000Z'),
  idGenerator: () => 'list-001',
};

test('creates a personal list with a stable ID and comparable timestamps', () => {
  const result = createList({ name: '  Work  ' }, dependencies);

  assert.deepEqual(result, {
    ok: true,
    list: {
      id: 'list-001',
      name: 'Work',
      createdAt: '2025-01-10T08:00:00.000Z',
      updatedAt: '2025-01-10T08:00:00.000Z',
    },
  });
});

test('rejects an empty list name and identifies the required correction', () => {
  const input = { name: '   ' };
  const result = createList(input, dependencies);

  assert.equal(result.ok, false);
  assert.deepEqual(result.input, input);
  assert.deepEqual(
    result.errors.map(({ field, code }) => ({ field, code })),
    [{ field: 'name', code: 'REQUIRED' }],
  );
  assert.match(result.errors[0].action, /non-empty.*name/i);
});

test('renames a list while preserving identity and creation time', () => {
  const created = createList({ name: 'Work' }, dependencies).list;
  const result = renameList(
    created,
    { name: '  Focus  ' },
    { clock: () => new Date('2025-01-10T08:00:00.000Z') },
  );

  assert.equal(result.ok, true);
  assert.equal(result.list.id, 'list-001');
  assert.equal(result.list.name, 'Focus');
  assert.equal(result.list.createdAt, '2025-01-10T08:00:00.000Z');
  assert.equal(result.list.updatedAt, '2025-01-10T08:00:00.001Z');
  assert.equal(created.name, 'Work');
  assert.equal(created.updatedAt, '2025-01-10T08:00:00.000Z');
});

test('a failed rename preserves the submitted input and source list', () => {
  const created = createList({ name: 'Work' }, dependencies).list;
  const before = structuredClone(created);
  const changes = { name: '' };

  const result = renameList(created, changes, dependencies);

  assert.equal(result.ok, false);
  assert.deepEqual(result.input, changes);
  assert.equal(result.errors[0].field, 'name');
  assert.deepEqual(created, before);
});
