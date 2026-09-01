/** Transport-neutral upload contract used by SyncQueue. */
export class CloudAdapter {
  async upload() {
    throw new Error('CloudAdapter.upload must be implemented by the transport.');
  }

  async pull() {
    return [];
  }
}

export function isCloudAdapter(value) {
  return Boolean(value) && typeof value.upload === 'function';
}
