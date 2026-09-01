function clone(value) {
  return structuredClone(value);
}

function relationError(code, message, action, input) {
  return {
    ok: false,
    errors: [{ field: 'parentId', code, message, action }],
    input: clone(input),
  };
}

/** Validate assigning parentId to taskId without changing either task. */
export function validateParentRelation({ taskId = null, parentId = null, getTask }) {
  const input = { taskId, parentId };
  if (parentId === undefined || parentId === null) {
    return { ok: true };
  }
  if (typeof getTask !== 'function') {
    throw new TypeError('getTask must be a function.');
  }

  const parent = getTask(parentId);
  if (!parent) {
    return relationError(
      'PARENT_NOT_FOUND',
      'parentId must reference an existing task.',
      'Choose an existing task as parentId before retrying.',
      input,
    );
  }
  if (taskId !== null && parentId === taskId) {
    return relationError(
      'SELF_PARENT',
      'A task cannot be its own parent.',
      'Choose a different task as parentId or clear parentId.',
      input,
    );
  }

  const visited = new Set();
  let current = parent;
  while (current && current.parentId !== undefined && current.parentId !== null) {
    if (taskId !== null && current.parentId === taskId) {
      return relationError(
        'PARENT_CYCLE',
        'parentId would create a cycle in the task hierarchy.',
        'Choose a parent outside this task subtree or clear parentId.',
        input,
      );
    }
    if (visited.has(current.id)) {
      return relationError(
        'PARENT_CYCLE',
        'parentId would preserve a cycle in the task hierarchy.',
        'Repair the existing parent chain before retrying parentId.',
        input,
      );
    }
    visited.add(current.id);
    current = getTask(current.parentId);
    if (!current) {
      return relationError(
        'PARENT_NOT_FOUND',
        'parentId references a task with a missing ancestor.',
        'Choose a parent with an intact hierarchy before retrying.',
        input,
      );
    }
  }

  return { ok: true };
}

/** Check whether a task may enter the existing completed state. */
export function checkSubtaskCompletion(task, directChildren = []) {
  const incompleteSubtaskIds = directChildren
    .filter((child) => child && child.status !== 'completed')
    .map((child) => child.id);

  if (incompleteSubtaskIds.length === 0) {
    return { ok: true, allowed: true, incompleteSubtaskIds: [] };
  }

  return {
    ok: false,
    allowed: false,
    code: 'INCOMPLETE_SUBTASKS',
    incompleteSubtaskIds,
    errors: [
      {
        field: 'parentId',
        code: 'INCOMPLETE_SUBTASKS',
        message: 'The task has incomplete direct subtasks.',
        action: 'Complete, reassign, or remove the listed subtasks before completing this task.',
      },
    ],
  };
}

