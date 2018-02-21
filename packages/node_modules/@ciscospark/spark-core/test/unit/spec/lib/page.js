/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import {Page} from '@ciscospark/spark-core';

describe('spark-core', () => {
  describe('page', () => {
    describe('#constructor', () => {
      let page;

      before(() => {
        sinon.stub(Page, 'parseLinkHeaders');
        const response = {
          body: {
            items: [1, 2, 3]
          },
          headers: {
            link: 'FakeHeaderLinks'
          }
        };
        page = new Page(response, 'FakeSpark');
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

      it('sets spark', () => {
        assert.equal(page.spark, 'FakeSpark');
      });
    });

    describe('#next', () => {
      let page, spark;

      before(() => {
        spark = {
          request: sinon.stub().returns(Promise.resolve({
            body: {
              items: [4, 5, 6]
            },
            headers: {
              link: '<https://www.cisco.com>; rel=previous'
            }
          }))
        };
        const response = {
          body: {
            items: [1, 2, 3]
          },
          headers: {
            link: '<https://www.cisco.com>; rel=next'
          }
        };
        page = new Page(response, spark);
      });

      it('has next link', () => {
        assert(page.hasNext());
      });

      it('retrieves previous link', () => page.next()
        .then((nextPage) => {
          assert.deepEqual(nextPage.items, [4, 5, 6]);
          assert.calledWith(spark.request, {uri: 'https://www.cisco.com'});
        }));
    });

    describe('#previous', () => {
      let page, spark;

      before(() => {
        spark = {
          request: sinon.stub().returns(Promise.resolve({
            body: {
              items: [4, 5, 6]
            },
            headers: {
              link: '<https://www.cisco.com>; rel=previous'
            }
          }))
        };
        const response = {
          body: {
            items: [1, 2, 3]
          },
          headers: {
            link: '<https://www.cisco.com>; rel=previous'
          }
        };
        page = new Page(response, spark);
      });

      it('has previous link', () => {
        assert(page.hasPrevious());
      });

      it('retrieves previous link', () => page.previous()
        .then((prevPage) => {
          assert.deepEqual(prevPage.items, [4, 5, 6]);
          assert.calledWith(spark.request, {uri: 'https://www.cisco.com'});
        }));
    });

    describe('#parseLinkHeaders', () => {
      const singleLinkHeader = '<https://www.cisco.com>; rel=cisco';
      const multipleLinkHeader = [
        '<https://www.ciscospark.com>; rel=ciscospark',
        '<https://www.cisco.com>; rel=cisco'
      ];

      it('returns empty object if there are not any link headers', () => {
        assert.deepEqual(Page.parseLinkHeaders(), {});
      });

      it('returns object containing one link if only one link header passed as a string', () => {
        assert.deepEqual(Page.parseLinkHeaders(singleLinkHeader), {
          cisco: 'https://www.cisco.com'
        });
      });

      it('returns object containing multiple links when multiple headers passed as an array', () => {
        assert.deepEqual(Page.parseLinkHeaders(multipleLinkHeader), {
          ciscospark: 'https://www.ciscospark.com',
          cisco: 'https://www.cisco.com'
        });
      });
    });
  });
});
