import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {SessionStore, storageKey} from '../../../../src/extension/sessionStore';
import type {ChromeStorageArea} from '../../../../src/extension/platform';

function createArea(): ChromeStorageArea & {data: Map<string, unknown>} {
  const data = new Map<string, unknown>();

  return {
    data,
    async get(keys) {
      const wanted = keys === null ? [...data.keys()] : Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};

      for (const key of wanted) {
        if (data.has(key)) {
          out[key] = data.get(key);
        }
      }

      return out;
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) {
        data.set(key, value);
      }
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        data.delete(key);
      }
    },
  };
}

describe('extension/sessionStore', () => {
  describe('storageKey', () => {
    it('namespaces by channel so two bridges never share state', () => {
      assert.equal(storageKey('webex-bridge', 'buffer'), 'webex-bridge:webex-bridge:buffer');
      assert.notEqual(storageKey('a', 'buffer'), storageKey('b', 'buffer'));
    });
  });

  it('returns the fallback when nothing is stored', async () => {
    const store = new SessionStore(createArea(), 'k', ['fallback']);

    assert.deepEqual(await store.read(), ['fallback']);
  });

  it('writes and reads back', async () => {
    const store = new SessionStore<number[]>(createArea(), 'k', []);

    await store.update(() => [1, 2, 3]);

    assert.deepEqual(await store.read(), [1, 2, 3]);
  });

  it('serialises concurrent updates so none is lost', async () => {
    const store = new SessionStore<number[]>(createArea(), 'k', []);

    await Promise.all([
      store.update((current) => [...current, 1]),
      store.update((current) => [...current, 2]),
      store.update((current) => [...current, 3]),
    ]);

    assert.deepEqual(await store.read(), [1, 2, 3]);
  });

  it('orders a read behind a pending update, so an accepted write is never missed', async () => {
    const store = new SessionStore<number[]>(createArea(), 'k', []);

    // The worker does exactly this: a CONNECT starts an update it does not await, and
    // the push that follows immediately reads the registry.
    void store.update((current) => [...current, 1]);

    assert.deepEqual(await store.read(), [1]);
  });

  it('treats an unreadable store as empty rather than throwing into a handler', async () => {
    const area = createArea();

    sinon.stub(area, 'get').rejects(new Error('storage is gone'));

    const store = new SessionStore(area, 'k', ['fallback']);

    assert.deepEqual(await store.read(), ['fallback']);
  });

  it('survives a failed write, since the buffer is a convenience not a guarantee', async () => {
    const area = createArea();

    sinon.stub(area, 'set').rejects(new Error('quota exceeded'));

    const store = new SessionStore<number[]>(area, 'k', []);

    assert.deepEqual(await store.update(() => [1]), [1]);
    assert.deepEqual(await store.read(), []);
  });

  it('keeps the write chain alive after a failure', async () => {
    const area = createArea();
    const set = sinon.stub(area, 'set');

    set.onFirstCall().rejects(new Error('transient'));
    set.callThrough();

    const store = new SessionStore<number[]>(area, 'k', []);

    await store.update(() => [1]);
    await store.update(() => [2]);

    assert.deepEqual(await store.read(), [2]);
  });
});
