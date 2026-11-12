import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import BaseClient from '../../../../src/base-client';
import TokenManager from '../../../../src/token-manager';
import DataSourceClient from '../../../../src/data-source-client';
import {httpUtils} from '../../../../src/http-utils';
import {ServiceAppToken} from '../../../../src/types';
import log from '../../../../src/Logger';

describe('BaseClient', () => {
  const baseUrl = 'https://webexapis.com/v1';
  let sandbox: sinon.SinonSandbox;
  let client: BaseClient;
  let getToken: sinon.SinonStub;
  let request: sinon.SinonStub;
  const response = {data: {id: 'source-id'}, status: 200};

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(log, 'setLogger');
    const tokenManager = new TokenManager({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      orgId: 'test-org',
    });
    getToken = sandbox
      .stub(tokenManager, 'getServiceAppToken')
      .resolves({accessToken: 'test-access-token'} as ServiceAppToken);
    request = sandbox.stub(httpUtils, 'request').resolves(response);
    client = new BaseClient(baseUrl, {'X-Client': 'value'}, tokenManager);
  });

  afterEach(() => sandbox.restore());

  it('exposes the data source client', () => {
    assert.instanceOf(client.dataSource, DataSourceClient);
  });

  const payload = {schemaId: 'schema-id'};
  [
    {
      method: 'GET',
      hasBody: false,
      send: () => client.get('/dataSources'),
      sendBound: () => client.getHttpClient().get('/dataSources'),
    },
    {
      method: 'POST',
      hasBody: true,
      send: () => client.post('/dataSources', payload),
      sendBound: () => client.getHttpClient().post('/dataSources', payload),
    },
    {
      method: 'PUT',
      hasBody: true,
      send: () => client.put('/dataSources', payload),
      sendBound: () => client.getHttpClient().put('/dataSources', payload),
    },
    {
      method: 'PATCH',
      hasBody: true,
      send: () => client.patch('/dataSources', payload),
      sendBound: () => client.getHttpClient().patch('/dataSources', payload),
    },
    {
      method: 'DELETE',
      hasBody: false,
      send: () => client.delete('/dataSources'),
      sendBound: () => client.getHttpClient().delete('/dataSources'),
    },
  ].forEach(({method, hasBody, send, sendBound}) => {
    it(`sends ${method} with the stored access token`, async () => {
      assert.deepEqual(await send(), response);
      assert.calledOnceWithExactly(getToken);
      assert.calledOnceWithExactly(request, `${baseUrl}/dataSources`, {
        method,
        ...(hasBody ? {body: JSON.stringify(payload)} : {}),
        headers: {
          'X-Client': 'value',
          ...(hasBody ? {'Content-Type': 'application/json'} : {}),
          Authorization: 'Bearer test-access-token',
        },
      });
    });

    it(`provides a bound ${method} method through getHttpClient`, async () => {
      assert.deepEqual(await sendBound(), response);
      assert.calledOnceWithExactly(getToken);
      assert.strictEqual(request.firstCall.args[1].method, method);
    });
  });

  it('keeps the configured access token when request headers supply another bearer', async () => {
    await client.request('/dataSources', {
      headers: {Authorization: 'Bearer other-token', 'X-Custom': 'value'},
    });
    assert.calledOnceWithExactly(request, `${baseUrl}/dataSources`, {
      headers: {
        'X-Client': 'value',
        Authorization: 'Bearer test-access-token',
        'X-Custom': 'value',
      },
    });
  });

  it('uses default request options', async () => {
    await client.request('/dataSources');
    assert.calledOnceWithExactly(request, `${baseUrl}/dataSources`, {
      headers: {'X-Client': 'value', Authorization: 'Bearer test-access-token'},
    });
  });

  it('does not send a request when no valid access token is available', async () => {
    getToken.rejects(new Error('Refresh failed'));
    await assert.isRejected(client.get('/dataSources'), Error, 'Failed to obtain token');
    assert.notCalled(request);
  });
});
