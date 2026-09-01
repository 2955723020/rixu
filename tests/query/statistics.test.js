import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCompletionHeatmap,
  calculateCompletionRate,
} from '../../src/query/statistics.js';

function instance(id, overrides = {}) {
  return {
    id,
    title: id,
    dueDate: '2025-03-02',
    startAt: null,
    endAt: null,
    timezone: 'UTC',
    status: 'pending',
    completedAt: null,
    recurrence: {
      frequency: 'monthly',
      anchorDay: 31,
      sourceRuleId: 'monthly-rule',
    },
    sourceTaskId: 'source-task',
    listId: null,
    tags: [],
    priority: 'none',
    parentId: null,
    createdAt: '2025-02-01T00:00:00.000Z',
    updatedAt: '2025-02-01T00:00:00.000Z',
    ...overrides,
  };
}

const marchRange = {
  from: '2025-03-01',
  to: '2025-03-03',
  timezone: 'Asia/Shanghai',
};

test('calculates exact completion counts and ratio for an inclusive due-date range', () => {
  const instances = [
    instance('from-completed', {
      dueDate: '2025-03-01',
      status: 'completed',
      completedAt: '2025-03-01T02:00:00.000Z',
    }),
    instance('middle-pending', { dueDate: '2025-03-02' }),
    instance('to-completed', {
      dueDate: '2025-03-03',
      status: 'completed',
      completedAt: '2025-03-04T02:00:00.000Z',
    }),
    instance('completed-without-time', {
      dueDate: '2025-03-03',
      status: 'completed',
    }),
    instance('before-range', {
      dueDate: '2025-02-28',
      status: 'completed',
      completedAt: '2025-02-28T02:00:00.000Z',
    }),
    instance('after-range', { dueDate: '2025-03-04' }),
  ];

  assert.deepEqual(calculateCompletionRate(instances, marchRange), {
    completed: 2,
    expected: 4,
    rate: 0.5,
  });
});

test('excludes cancelled instances from expected and returns zero for an empty denominator', () => {
  const instances = [
    instance('cancelled', { status: 'cancelled' }),
    instance('outside', { dueDate: '2025-03-04' }),
  ];

  assert.deepEqual(calculateCompletionRate(instances, marchRange), {
    completed: 0,
    expected: 0,
    rate: 0,
  });
  assert.equal(Number.isFinite(calculateCompletionRate(instances, marchRange).rate), true);
});

test('aggregates completed instants by local date and counts recurrence instances separately', () => {
  const instances = [
    instance('repeat-1', {
      status: 'completed',
      completedAt: '2025-03-02T07:30:00.000Z',
    }),
    instance('repeat-2', {
      status: 'completed',
      completedAt: '2025-03-02T07:45:00.000Z',
    }),
    instance('repeat-3', {
      status: 'completed',
      completedAt: '2025-03-02T08:30:00.000Z',
    }),
    instance('outside', {
      status: 'completed',
      completedAt: '2025-03-04T08:00:00.000Z',
    }),
    instance('pending-with-time', {
      completedAt: '2025-03-02T08:45:00.000Z',
    }),
  ];

  assert.deepEqual(
    buildCompletionHeatmap(instances, {
      from: '2025-03-01',
      to: '2025-03-03',
      timezone: 'America/Los_Angeles',
    }),
    {
      '2025-03-01': 2,
      '2025-03-02': 1,
    },
  );
});

test('statistics queries preserve nested input data and are deterministic', () => {
  const instances = [
    instance('completed', {
      status: 'completed',
      completedAt: '2025-03-02T10:00:00.000Z',
      tags: ['focus'],
      recurrence: {
        frequency: 'custom',
        interval: 2,
        unit: 'week',
        weekdays: [1, 5],
      },
    }),
  ];
  const before = structuredClone(instances);

  const firstRate = calculateCompletionRate(instances, marchRange);
  const secondRate = calculateCompletionRate(instances, marchRange);
  const firstHeatmap = buildCompletionHeatmap(instances, marchRange);
  const secondHeatmap = buildCompletionHeatmap(instances, marchRange);

  assert.deepEqual(firstRate, secondRate);
  assert.deepEqual(firstHeatmap, secondHeatmap);
  assert.deepEqual(instances, before);
});
