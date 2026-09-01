function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function timestamp(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function compareText(left, right) {
  const a = String(left);
  const b = String(right);
  return a === b ? 0 : a > b ? 1 : -1;
}

function tieKey(version) {
  return [
    version?.deviceId ?? '',
    version?.operationId ?? version?.idempotencyKey ?? '',
    version?.entityType ?? '',
    version?.entityId ?? version?.payload?.id ?? version?.tombstone?.entityId ?? '',
  ].map((part) => String(part)).join('\u0000');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Compare two versions: positive means left wins, negative means right wins. */
export function compareVersions(left, right) {
  if (!left) return right ? -1 : 0;
  if (!right) return 1;
  const leftTime = timestamp(left.updatedAt);
  const rightTime = timestamp(right.updatedAt);
  if (leftTime !== rightTime) return leftTime > rightTime ? 1 : -1;
  const byDevice = compareText(left.deviceId ?? '', right.deviceId ?? '');
  if (byDevice !== 0) return byDevice > 0 ? 1 : -1;
  const byTie = compareText(tieKey(left), tieKey(right));
  if (byTie !== 0) return byTie > 0 ? 1 : -1;
  const bySnapshot = compareText(canonical(left), canonical(right));
  return bySnapshot === 0 ? 0 : bySnapshot > 0 ? 1 : -1;
}

export function resolveConflict(left, right) {
  return clone(compareVersions(left, right) >= 0 ? left : right);
}

export class ConflictResolver {
  static compare(left, right) {
    return compareVersions(left, right);
  }

  static resolve(left, right) {
    return resolveConflict(left, right);
  }

  compare(left, right) {
    return compareVersions(left, right);
  }

  resolve(left, right) {
    return resolveConflict(left, right);
  }
}

export default ConflictResolver;
