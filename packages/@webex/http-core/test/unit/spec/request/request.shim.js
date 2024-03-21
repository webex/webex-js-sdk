import {assert} from '@webex/test-helper-chai';
import window from 'global/window';
import request from '@webex/http-core/src/request/request.shim';
import {EventEmitter} from 'events';

describe('Request shim', () => {
  describe('#setAuth()', () => {
    beforeAll(() => {
      global.Blob = function (content, options) {
        return { content, options };
      };
    });
    it('sets auth header', () => {

      class DummyXMLHttpRequest {
        upload = new EventEmitter();
      }

      window.XMLHttpRequest = DummyXMLHttpRequest;

      const options = {upload: new EventEmitter(), headers: [], method: 'post', ...options, auth: {user: 'test', pass: 'pw'}, logger: {warn: () => {}}};

      request(options);

      assert.equal(options.headers.Authorization, 'Basic dGVzdDpwdw==');
    });
  });
});
