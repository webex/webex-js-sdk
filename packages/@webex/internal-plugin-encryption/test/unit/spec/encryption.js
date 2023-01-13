/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
/* eslint-disable no-underscore-dangle */
import Url from 'url';

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Encryption from '@webex/internal-plugin-encryption';

describe('internal-plugin-encryption', () => {
  describe('download', () => {
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          encryption: Encryption,
        },
      });
    });

    describe('check _fetchDownloadUrl()', () => {
      const scrArray = [
        {
          loc: 'https://files-api-intb1.ciscospark.com/v1/spaces/a0cba376-fc05-4b88-af4b-cfffa7465f9a/contents/1d3931e7-9e31-46bc-8084-d766a8f72c99/versions/5fa9caf87a98410aae49e0173856a974/bytes',
        },
        {
          loc: 'https://files-api-intb2.ciscospark.com/v1/spaces/a0cba376-fc05-4b88-af4b-cfffa7465f9a/contents/1d3931e7-9e31-46bc-8084-d766a8f72c99/versions/5fa9caf87a98410aae49e0173856a974/bytes',
        },
        {
          loc: 'https://www.test-api.com/v1/spaces/test-path-name-space/contents/test-path-name-contents/versions/test-version/bytes',
        },
        {
          loc: 'http://www.test-api.com/v1/spaces/test-path-name-space/contents/test-path-name-contents/versions/test-version/bytes',
        },
      ];
      const options = undefined;
      let spyStub;

      beforeEach(() => {
        const returnStub = (obj) => Promise.resolve(obj);

        spyStub = sinon.stub(webex.internal.encryption, 'request').callsFake(returnStub);

        scrArray.forEach((scr) => webex.internal.encryption._fetchDownloadUrl(scr, options));
      });

      it('verifying file service uris', () => {
        assert.equal(
          spyStub.args[0][0].uri,
          'https://files-api-intb1.ciscospark.com/v1/download/endpoints'
        );
        assert.equal(
          spyStub.args[1][0].uri,
          'https://files-api-intb2.ciscospark.com/v1/download/endpoints'
        );
        assert.equal(spyStub.args[2][0].uri, 'https://www.test-api.com/v1/download/endpoints');
        assert.equal(spyStub.args[3][0].uri, 'https://www.test-api.com/v1/download/endpoints');
      });

      it('verifying https', () => {
        assert.equal(Url.parse(spyStub.args[0][0].uri).protocol, 'https:');
        assert.equal(Url.parse(spyStub.args[1][0].uri).protocol, 'https:');
        assert.equal(Url.parse(spyStub.args[2][0].uri).protocol, 'https:');
        assert.equal(Url.parse(spyStub.args[3][0].uri).protocol, 'https:');
      });

      it('verifying endpoints', () => {
        assert.equal(spyStub.args[0][0].body.endpoints[0], scrArray[0].loc);
        assert.equal(spyStub.args[1][0].body.endpoints[0], scrArray[1].loc);
        assert.equal(spyStub.args[2][0].body.endpoints[0], scrArray[2].loc);
        assert.equal(spyStub.args[3][0].body.endpoints[0], scrArray[3].loc);
      });

      afterEach(() => {
        spyStub.resetHistory();
      });
    });
  });
});
