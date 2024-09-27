import {InMemoryTokenStorageAdapter} from '../../../../src/token-storage-adapter/inMemoryTokenStorage';;
import {OrgServiceAppAuthorization} from '../../../../src/types';;

describe('InMemoryTokenStorageAdapter', () => {
  let tokenStorage: InMemoryTokenStorageAdapter;
  const orgId = 'org-123';
  const token: OrgServiceAppAuthorization = {
    orgId,
    serviceAppToken: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      refreshAccessTokenExpiresAt: new Date(Date.now() + 7200 * 1000),
    },
  };

  beforeEach(() => {
    tokenStorage = new InMemoryTokenStorageAdapter();
  });

  test('should store a token', () => {
    tokenStorage.setToken(orgId, token);
    expect(tokenStorage.getToken(orgId)).toEqual(token);
  });

  test('should retrieve a token', () => {
    tokenStorage.setToken(orgId, token);
    const retrievedToken = tokenStorage.getToken(orgId);
    expect(retrievedToken).toEqual(token);
  });

  test('should return undefined for a non-existent token', () => {
    const retrievedToken = tokenStorage.getToken('non-existent-org');
    expect(retrievedToken).toBeUndefined();
  });

  test('should list all stored tokens', () => {
    const dummyOrgId = 'org-456';
    const dummyToken: OrgServiceAppAuthorization = {
      orgId: dummyOrgId,
      serviceAppToken: {
        accessToken: 'another-access-token',
        refreshToken: 'another-refresh-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        refreshAccessTokenExpiresAt: new Date(Date.now() + 7200 * 1000),
      },
    };

    tokenStorage.setToken(orgId, token);
    tokenStorage.setToken(dummyOrgId, dummyToken);

    const tokens = tokenStorage.listTokens();
    expect(tokens).toContain(token);
    expect(tokens).toContain(dummyToken);});
});