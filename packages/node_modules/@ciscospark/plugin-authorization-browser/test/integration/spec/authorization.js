/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/plugin-authorization-node';
import {browserOnly} from '@ciscospark/test-helper-mocha';
import {assert} from '@ciscospark/test-helper-chai';
import {createUser} from '@ciscospark/test-helper-appid';
import CiscoSpark from '@ciscospark/spark-core';
import uuid from 'uuid';

browserOnly(describe)('plugin-authorization-browser', () => {
  describe('Authorization', () => {
    describe('#requestAccessTokenFromJwt', () => {
      it('exchanges a JWT for an appid access token', () => {
        const userId = uuid.v4();
        const displayName = `test-${userId}`;
        return createUser({displayName, userId})
          .then(({jwt}) => {
            const spark = new CiscoSpark();
            return spark.authorization.requestAccessTokenFromJwt({jwt})
              .then(() => assert.isTrue(spark.canAuthorize));
          });
      });
    });

    describe('\'#refresh', () => {
      describe('when used with an appid access token', () => {
        it('refreshes the access token', () => {
          const userId = uuid.v4();
          const displayName = `test-${userId}`;
          return createUser({displayName, userId})
            .then(({jwt}) => {
              const spark = new CiscoSpark({
                config: {
                  credentials: {
                    jwtRefreshCallback() {
                      return createUser({displayName, userId})
                        .then(({jwt}) => jwt);
                    }
                  }
                }
              });
              let token;
              return spark.authorization.requestAccessTokenFromJwt({jwt})
                .then(() => {
                  token = spark.credentials.supertoken.access_token;
                  assert.isTrue(spark.canAuthorize);
                })
                .then(() => spark.refresh())
                .then(() => {
                  assert.isTrue(spark.canAuthorize);
                  assert.notEqual(spark.credentials.supertoken.access_token, token);
                });
            });
        });
      });
    });
  });
});
