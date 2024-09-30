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

  it('should verify the token and return payload when valid', async () => {
    const jws = 'valid-jwt';
    const mockPayload = { exp: Math.floor(Date.now() / 1000) + 3600 }; // Token expires in 1 hour
    const mockProtectedHeader = { alg: 'HS256' };

    (jwtVerify as jest.Mock).mockResolvedValueOnce({
      payload: mockPayload,
      protectedHeader: mockProtectedHeader,
    });

    const result = await sdk.verifyToken(jws);
    // @ts-ignore 
    expect(jwtVerify).toHaveBeenCalledWith(jws, sdk.jwks);
    expect(result).toEqual(mockPayload);
  });

  it('should throw an error if the token has expired', async () => {
    const jws = 'expired-jwt';
    const mockPayload = { exp: Math.floor(Date.now() / 1000) - 3600 }; // Token expired 1 hour ago
    const mockProtectedHeader = { alg: 'HS256' };

    (jwtVerify as jest.Mock).mockResolvedValueOnce({
      payload: mockPayload,
      protectedHeader: mockProtectedHeader,
    });

    await expect(sdk.verifyToken(jws)).rejects.toThrow('Token has expired');
  });

  it('should throw an error if jwtVerify throws an error', async () => {
    const jws = 'invalid-jwt';
    const errorMessage = 'Invalid token';

    (jwtVerify as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    await expect(sdk.verifyToken(jws)).rejects.toThrow(`Failed to verify token: ${errorMessage}`);
  });
});
