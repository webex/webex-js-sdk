import {assert} from '@webex/test-helper-chai';
import {InMemoryTokenStorageAdapter} from '../../../../src/token-storage-adapter';
import {ServiceAppToken} from '../../../../src/types';

describe('InMemoryTokenStorageAdapter', () => {
  const token: ServiceAppToken = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: new Date('2026-10-20T10:00:00Z'),
    refreshAccessTokenExpiresAt: new Date('2026-10-21T10:00:00Z'),
  };
  let storage: InMemoryTokenStorageAdapter;

  beforeEach(() => {
    storage = new InMemoryTokenStorageAdapter();
  });

  it('stores and retrieves the token pair', async () => {
    await storage.setToken(token);
    assert.deepEqual(await storage.getToken(), token);
  });

  it('accepts an initial token pair', async () => {
    storage = new InMemoryTokenStorageAdapter(token);
    assert.deepEqual(await storage.getToken(), token);
  });

  it('replaces the stored token pair', async () => {
    await storage.setToken(token);
    const replacement = {...token, accessToken: 'replacement-access-token'};
    await storage.setToken(replacement);
    assert.deepEqual(await storage.getToken(), replacement);
  });

  it('deletes the stored pair', async () => {
    await storage.setToken(token);
    await storage.deleteToken();
    await assert.isRejected(storage.getToken(), Error, 'Service App token not found');
  });

  ['getToken', 'deleteToken'].forEach((method: 'getToken' | 'deleteToken') => {
    it(`rejects ${method} when no token is stored`, async () => {
      await assert.isRejected(storage[method](), Error, 'Service App token not found');
    });
  });
});
