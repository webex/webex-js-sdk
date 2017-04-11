/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import spark from '../../..';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';

describe(`ciscospark`, function() {
  this.timeout(60000);
  describe(`#people`, () => {
    let user1;
    before(() => {
      return testUsers.create({count: 1})
        .then((users) => {
          user1 = users[0];
        });
    });

    describe(`#get()`, () => {
      it(`retrieves a specific person`, () => {
        return spark.people.get({
          personId: user1.id
        })
          .then((person) => {
            assert.isPerson(person);
          });
      });
    });

    describe(`#list()`, () => {
      it(`returns a specific person by email address`, () => {
        return spark.people.list({
          email: user1.email
        })
          .then((people) => {
            assert.isDefined(people);
            assert.isAbove(people.length, 0);
            for (const person of people) {
              assert.isPerson(person);
            }
          });
      });

      it(`returns a specific person by name`, () => {
        return spark.people.list({
          displayName: user1.name
        })
          .then((people) => {
            assert.isDefined(people);
            assert.isAbove(people.length, 0);
            for (const person of people) {
              assert.isPerson(person);
            }
          });
      });
    });
  });
});
