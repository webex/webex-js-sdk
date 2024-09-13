import BYODS from './BYODS';
import TokenManager from './TokenManager';
import BaseClient from './BaseClient';
import {SDKConfig} from './types';
import DataSourceClient from './DataSourceClient';

jest.mock('node-fetch', () => jest.fn());

describe('BYODS Tests', () => {
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
});
