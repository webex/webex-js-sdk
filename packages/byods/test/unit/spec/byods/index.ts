import BYODS from '../../../../src/byods';
import TokenManager from '../../../../src/token-manager';
import BaseClient from '../../../../src/base-client';
import {SDKConfig} from '../../../../src/types';
import DataSourceClient from '../../../../src/data-source-client';
import { jwtVerify, createRemoteJWKSet } from 'jose';

jest.mock('node-fetch', () => jest.fn());

jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
  createRemoteJWKSet: jest.fn()
}));

describe('BYODS Tests', () => {
  beforeAll(() => {
    console.error = jest.fn();
  });
  const mockSDKConfig: SDKConfig = {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
  };

  const sdk = new BYODS(mockSDKConfig);

  it('should create an instance of BYODS', () => {
    expect(sdk).toBeInstanceOf(BYODS);
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

  it('should return true when token is valid', async () => {
    const jws = 'valid-jwt';

    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: {},
      protectedHeader: { alg: 'HS256' },
    });

    const result = await sdk.verifyToken(jws);

    expect(jwtVerify).toHaveBeenCalledWith(jws, sdk.jwks);
    expect(result).toEqual({ isValid: true });
  });

  it('should return false with error if the token has expired', async () => {
    const jws = 'expired-jwt';
    const errorMessage = 'Token has expired';

    (jwtVerify as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    const result = await sdk.verifyToken(jws);

    expect(jwtVerify).toHaveBeenCalledWith(jws, sdk.jwks);
    expect(result).toEqual({ isValid: false, error: errorMessage });
  });

  it('should return false with error if jwtVerify throws an error', async () => {
    const jws = 'invalid-jwt';
    const errorMessage = 'Invalid token';

    (jwtVerify as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    const result = await sdk.verifyToken(jws);

    expect(jwtVerify).toHaveBeenCalledWith(jws, sdk.jwks);
    expect(result).toEqual({ isValid: false, error: `Invalid token` });
  });
});