import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {EventEmitter} from 'events';
import request from '@webex/http-core/src/request';
import * as requestModule from '../../../../src/request/request';
import * as utils from '../../../../src/request/utils';

describe('request', () => {
  let interceptStub;
  let requestStub;

  beforeEach(() => {
    interceptStub = sinon.spy(utils, 'intercept');
    requestStub = sinon.stub(requestModule, 'default');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should modify options and call _request if no custom request function is provided', async () => {
    const options = {
      url: 'http://example.com',
      headers: {},
      interceptors: [],
    };

    requestStub.resolves('response');

    const result = await request(options);

    assert.strictEqual(result, 'response');
    assert.strictEqual(options.uri, 'http://example.com');
    assert.isNull(options.url);
    assert.deepEqual(options.headers, {});
    assert.instanceOf(options.download, EventEmitter);
    assert.instanceOf(options.upload, EventEmitter);
    assert.isTrue(interceptStub.calledTwice);
    assert.isTrue(requestStub.calledOnceWith(options));
  });

  it('should use custom request function if provided', async () => {
    const customRequest = sinon.stub().resolves('custom response');
    const options = {
      url: 'http://example.com',
      headers: {},
      interceptors: [],
      request: customRequest,
    };

    const result = await request(options);

    assert.strictEqual(result, 'custom response');
    assert.isTrue(customRequest.calledOnceWith(options));
    assert.isTrue(interceptStub.calledTwice);
    assert.isFalse(requestStub.called);
  });
});
