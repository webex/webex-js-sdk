/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable camelcase */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import {LocusRouteTokenInterceptor} from '@webex/plugin-meetings/src/interceptors';
import Meetings from '@webex/plugin-meetings';

const X_CISCO_PART_ROUTE_TOKEN = 'X-Cisco-Part-Route-Token';

describe('LocusRouteTokenInterceptor', () => {
  let interceptor, webex;
  const TEST_LOCUS_ID = '0f1eba56-91e2-2a11-9b2b-1e2da077f066';
  beforeEach(() => {
    webex = new MockWebex({
      children: {
        meetings: Meetings,
      },
    });
    interceptor = Reflect.apply(LocusRouteTokenInterceptor.create, webex, []);
  });

  it('getLocusIdByRequestUrl should return locusId from url', () => {
    const url = `https://locus-test.webex.com/locus/api/v1/loci/${TEST_LOCUS_ID}/foo`;
    assert.equal(interceptor.getLocusIdByRequestUrl(url), TEST_LOCUS_ID);
  });

  it('getLocusIdByRequestUrl should return undefined when no locusId in url', () => {
    const url = 'https://locus-test.webex.com/locus/api/v1/foo';
    assert.isUndefined(interceptor.getLocusIdByRequestUrl(url));
  });

  it('getLocusIdByRequestUrl should return undefined when url is undefined', () => {
    assert.isUndefined(interceptor.getLocusIdByRequestUrl(undefined));
  });

  it('onResponse should store route token when header exists', async () => {
    const response = {
      headers: {
        [X_CISCO_PART_ROUTE_TOKEN]: 'test-token',
      },
    };

    const result = await interceptor.onResponse(
      {
        uri: `https://locus-test.webex.com/locus/api/v1/loci/${TEST_LOCUS_ID}/foo`,
      },
      response
    );
    assert.equal(result, response);
    assert.equal(interceptor.getToken(TEST_LOCUS_ID), 'test-token');
  });

  it('onResponse should not store token when header missing', async () => {
    interceptor.updateToken(TEST_LOCUS_ID);
    const response = {headers: {}};

    await interceptor.onResponse({}, response);
    assert.isUndefined(interceptor.getToken(TEST_LOCUS_ID));
  });

  it('onRequest should attach token to headers when token exists', async () => {
    interceptor.updateToken(TEST_LOCUS_ID, 'abc123');

    const options = {
      headers: {},
      uri: `https://locus-test.webex.com/locus/api/v1/loci/${TEST_LOCUS_ID}/foo`,
    };
    const result = await interceptor.onRequest(options);
    assert.equal(result.headers[X_CISCO_PART_ROUTE_TOKEN], 'abc123');
  });

  it('onRequest should not attach token if none is stored', async () => {
    interceptor.updateToken(TEST_LOCUS_ID);
    const options = {headers: {}};
    const result = await interceptor.onRequest(options);
    assert.isUndefined(result.headers[X_CISCO_PART_ROUTE_TOKEN]);
  });

  it('updateToken & getToken should work as pair', () => {
    interceptor.updateToken(TEST_LOCUS_ID, 'abc456');
    assert.equal(interceptor.getToken(TEST_LOCUS_ID), 'abc456');
  });
});
