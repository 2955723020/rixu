const PRIORITY_ORDER = Object.freeze(['urgent', 'high', 'medium', 'low', 'none']);
const PRIORITY_RANK = new Map(PRIORITY_ORDER.map((priority, index) => [priority, index]));

function sourceTasks(tasks) {
  return Array.isArray(tasks) ? tasks : [];
}

function clone(value) {
  return structuredClone(value);
}

function filterTasks(tasks, predicate) {
  return sourceTasks(tasks).filter(predicate).map((task) => clone(task));
}

export function filterByListId(tasks, listId) {
  return filterTasks(tasks, (task) => task.listId === listId);
}

export function filterByTag(tasks, tag) {
  return filterTasks(
    tasks,
    (task) => Array.isArray(task.tags) && task.tags.includes(tag),
  );
}

export function filterByPriority(tasks, priority) {
  return filterTasks(tasks, (task) => task.priority === priority);
}

export function sortByPriority(tasks) {
  return sourceTasks(tasks)
    .map((task, index) => ({ task, index }))
    .sort((left, right) => {
      const leftRank = PRIORITY_RANK.get(left.task.priority) ?? PRIORITY_ORDER.length;
      const rightRank = PRIORITY_RANK.get(right.task.priority) ?? PRIORITY_ORDER.length;
      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ task }) => clone(task));
}

export { PRIORITY_ORDER };
