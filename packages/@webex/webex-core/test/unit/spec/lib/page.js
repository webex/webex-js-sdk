/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {Page} from '@webex/webex-core';

describe('webex-core', () => {
  describe('page', () => {
    describe('#constructor', () => {
      let page;

      beforeAll(() => {
        sinon.stub(Page, 'parseLinkHeaders');
        const response = {
          body: {
            items: [1, 2, 3],
          },
          headers: {
            link: 'FakeHeaderLinks',
          },
        };

        page = new Page(response, 'FakeWebex');
      });

      after(() => {
        Page.parseLinkHeaders.restore();
      });

      it('stores response items', () => {
        assert.deepEqual(page.items, [1, 2, 3]);
      });

      it('parses header links', () => {
        assert.calledWith(Page.parseLinkHeaders, 'FakeHeaderLinks');
      });

      it('sets webex', () => {
        assert.equal(page.webex, 'FakeWebex');
      });
    });

    describe('#next', () => {
      let page, webex;

      beforeAll(() => {
        webex = {
          request: sinon.stub().returns(
            Promise.resolve({
              body: {
                items: [4, 5, 6],
              },
              headers: {
                link: '<https://www.cisco.com>; rel=previous',
              },
            })
          ),
        };
        const response = {
          body: {
            items: [1, 2, 3],
          },
          headers: {
            link: '<https://www.cisco.com>; rel=next',
          },
        };

        page = new Page(response, webex);
      });

      it('has next link', () => {
        assert(page.hasNext());
      });

      it('retrieves previous link', () =>
        page.next().then((nextPage) => {
          assert.deepEqual(nextPage.items, [4, 5, 6]);
          assert.calledWith(webex.request, {uri: 'https://www.cisco.com'});
        }));
    });

    describe('#previous', () => {
      let page, webex;

      beforeAll(() => {
        webex = {
          request: sinon.stub().returns(
            Promise.resolve({
              body: {
                items: [4, 5, 6],
              },
              headers: {
                link: '<https://www.cisco.com>; rel=previous',
              },
            })
          ),
        };
        const response = {
          body: {
            items: [1, 2, 3],
          },
          headers: {
            link: '<https://www.cisco.com>; rel=previous',
          },
        };

        page = new Page(response, webex);
      });

      it('has previous link', () => {
        assert(page.hasPrevious());
      });

      it('retrieves previous link', () =>
        page.previous().then((prevPage) => {
          assert.deepEqual(prevPage.items, [4, 5, 6]);
          assert.calledWith(webex.request, {uri: 'https://www.cisco.com'});
        }));
    });

    describe('#parseLinkHeaders', () => {
      const singleLinkHeader = '<https://www.cisco.com>; rel=cisco';
      const multipleLinkHeader = [
        '<https://www.ciscospark.com>; rel=webex',
        '<https://www.cisco.com>; rel=cisco',
      ];

      it('returns empty object if there are not any link headers', () => {
        assert.deepEqual(Page.parseLinkHeaders(), {});
      });

      it('returns object containing one link if only one link header passed as a string', () => {
        assert.deepEqual(Page.parseLinkHeaders(singleLinkHeader), {
          cisco: 'https://www.cisco.com',
        });
      });

      it('returns object containing multiple links when multiple headers passed as an array', () => {
        assert.deepEqual(Page.parseLinkHeaders(multipleLinkHeader), {
          webex: 'https://www.ciscospark.com',
          cisco: 'https://www.cisco.com',
        });
      });
    });
  });
});
