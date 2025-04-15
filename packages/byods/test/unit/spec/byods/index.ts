import BYODS from '../../../../src/byods';
import TokenManager from '../../../../src/token-manager';
import BaseClient from '../../../../src/base-client';
import {SDKConfig} from '../../../../src/types';
import {InMemoryTokenStorageAdapter} from '../../../../src/token-storage-adapter';
import DataSourceClient from '../../../../src/data-source-client';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import log from '../../../../src/Logger';
import {LOGGER} from '../../../../src/Logger/types';
import {BYODS_MODULE, INTEGRATION_BASE_URL, INTEGRATION_JWKS_URL, PRODUCTION_BASE_URL, PRODUCTION_JWKS_URL} from '../../../../src/constants';

jest.mock('node-fetch', () => jest.fn());

jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
  createRemoteJWKSet: jest.fn()
}));

describe('BYODS Tests', () => {
  beforeAll(() => {
    log.setLogger = jest.fn();
  });

  beforeEach(() => {
    jest.resetModules(); // Clears the cache to ensure process.env changes are picked up
  });

  afterEach(() => {
    delete process.env.BYODS_ENVIRONMENT; // Clean up the environment variable
  });

  const clientId = 'test-client-id';
  const clientSecret = 'test-client-secret';

  const mockSDKConfig: SDKConfig = {
    clientId,
    clientSecret,
    tokenStorageAdapter: new InMemoryTokenStorageAdapter(),
    logger: { level: LOGGER.ERROR },
  };

  const sdk = new BYODS(mockSDKConfig);

  it('should create an instance of BYODS', () => {
    expect(sdk).toBeInstanceOf(BYODS);
  });

  it('should initialize with default logger configuration', () => {
    log.setLogger = jest.fn();
    const sdk = new BYODS(mockSDKConfig);
    expect(log.setLogger).toHaveBeenCalledWith(LOGGER.ERROR, BYODS_MODULE);
  });

  it('should initialize TokenManager with correct parameters', () => {
    expect(sdk.tokenManager).toBeInstanceOf(TokenManager);
  });

  it('should get a client for an organization', () => {
    expect(sdk.getClientForOrg('myOrgId')).toBeInstanceOf(BaseClient);
  });

  it('should configure DataSourceClient with correct parameters', () => {
    expect(sdk.getClientForOrg('myOrgId').dataSource).toBeInstanceOf(DataSourceClient);
  });

  it('should return true when JWS token is valid', async () => {
    const jws = 'valid-jws';

    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: {},
      protectedHeader: { alg: 'HS256' },
    });

    const result = await sdk.verifyJWSToken(jws);

    expect(jwtVerify).toHaveBeenCalledWith(jws, sdk.jwks);
    expect(result).toEqual({ isValid: true });
  });

  it('should return false with error if the JWS token has expired', async () => {
    const jws = 'expired-jws';
    const errorMessage = 'Token has expired';

    (jwtVerify as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    const result = await sdk.verifyJWSToken(jws);

    expect(jwtVerify).toHaveBeenCalledWith(jws, sdk.jwks);
    expect(result).toEqual({ isValid: false, error: errorMessage });
  });

  it('should return false with error if JWS Verify throws an error', async () => {
    const jws = 'invalid-jws';
    const errorMessage = 'Invalid token';

    (jwtVerify as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    const result = await sdk.verifyJWSToken(jws);

    expect(jwtVerify).toHaveBeenCalledWith(jws, sdk.jwks);
    expect(result).toEqual({ isValid: false, error: `Invalid token` });
  });

  it('should default to production environment if BYODS_ENVIRONMENT is not set', () => {
    const config: SDKConfig = {clientId, clientSecret};
    const sdk = new BYODS(config);

    expect(sdk['env']).toBe('production');
    expect(sdk['baseUrl']).toBe(PRODUCTION_BASE_URL);
  });

  it('should use integration environment if BYODS_ENVIRONMENT is set to integration', () => {
    process.env.BYODS_ENVIRONMENT = 'integration';
    const config: SDKConfig = {clientId, clientSecret};
    const sdk = new BYODS(config);

    expect(sdk['env']).toBe('integration');
    expect(sdk['baseUrl']).toBe(INTEGRATION_BASE_URL);
  });

  it('should default to production environment if BYODS_ENVIRONMENT is set to an invalid value', () => {
    process.env.BYODS_ENVIRONMENT = 'invalid-env';
    const config: SDKConfig = {clientId, clientSecret};
    const sdk = new BYODS(config);

    expect(sdk['env']).toBe('production');
    expect(sdk['baseUrl']).toBe(PRODUCTION_BASE_URL);
  });

});
