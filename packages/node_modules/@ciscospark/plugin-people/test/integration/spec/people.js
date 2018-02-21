/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-mercury';
import '@ciscospark/plugin-people';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
import sinon from '@ciscospark/test-helper-sinon';

describe('plugin-people', function () {
  this.timeout(60000);
  describe('People', () => {
    let bones, mccoy, spock;

    beforeEach('create users', () => testUsers.create({count: 3})
      .then((users) => {
        [spock, mccoy, bones] = users;
        spock.spark = new CiscoSpark({
          credentials: {
            authorization: users[0].token
          }
        });
        mccoy.spark = new CiscoSpark({
          credentials: {
            authorization: users[1].token
          }
        });
      }));

    describe('#get()', () => {
      it('gets a person by id', () => spock.spark.people.get(mccoy.id)
        .then((peopleResponse) => {
          assert.isPerson(peopleResponse);
          assert.equal(peopleResponse.emails[0], mccoy.email);
        }));

      it('gets the current user with "get(\'me\')"', () => spock.spark.people.get('me')
        .then((peopleResponse) => {
          assert.isPerson(peopleResponse);
          assert.equal(peopleResponse.emails[0], spock.email);
        }));

      it('gets a user by hydra id', () => spock.spark.people.get('me')
        .then((person) => spock.spark.people.get(person.id))
        .then((person) => {
          assert.isPerson(person);
          assert.equal(person.emails[0], spock.email);
        }));

      it('gets multiple users at a time', () => Promise.all([
        spock.spark.people.get(mccoy.id),
        spock.spark.people.get('me')
      ])
        .then((peopleResponse) => {
          assert.isPerson(peopleResponse[0]);
          assert.isPerson(peopleResponse[1]);
          assert.equal(peopleResponse[0].emails[0], mccoy.email);
          assert.equal(peopleResponse[1].emails[0], spock.email);
        }));
    });

    describe('#list()', () => {
      it('gets a group of people by ids', () => spock.spark.people.list([mccoy.id, spock.id, bones.id])
        .then((peopleResponse) => {
          assert.equal(peopleResponse.length, 3);
          assert.isPerson(peopleResponse[0]);
          assert.isPerson(peopleResponse[1]);
          assert.isPerson(peopleResponse[2]);
          assert.equal(peopleResponse[0].emails[0], mccoy.email);
          assert.equal(peopleResponse[1].emails[0], spock.email);
        }));

      it('defaults to false showAllTypes', () => spock.spark.people.list([mccoy.id, spock.id, bones.id])
        .then(assert.isFalse(spock.spark.people.batcher.config.showAllTypes)));

      it('sets showAllTypes to true', () => {
        spock.spark.people.batcher.config.showAllTypes = true;
        return spock.spark.people.list([mccoy.id, spock.id, bones.id])
          .then(assert.isTrue(spock.spark.people.batcher.config.showAllTypes));
      });

      it('returns a list of people matching email address', () => spock.spark.people.list({email: mccoy.email})
        .then((peopleResponse) => {
          assert.isAbove(peopleResponse.items.length, 0);
          const person = peopleResponse.items[0];
          assert.isPerson(person);
          assert.equal(person.emails[0], mccoy.email);
        }));

      it('returns a list of people matching name', () => spock.spark.people.list({displayName: mccoy.name})
        .then((peopleResponse) => {
          assert.isAbove(peopleResponse.items.length, 0);
          let isMccoyFound = false;
          peopleResponse.items.forEach((person) => {
            if (person.displayName === mccoy.name) {
              isMccoyFound = true;
            }
            assert.isPerson(person);
          });
          assert.isTrue(isMccoyFound);
        }));

      describe('batching of people requests', () => {
        let batchTestUsers;
        beforeEach('create more users', () => testUsers.create({count: 6})
          .then((users) => {
            batchTestUsers = users;
          }));

        it('batches uuid get requests into one', () => {
          sinon.spy(spock.spark.people.batcher, 'submitHttpRequest');
          return Promise.all(batchTestUsers.map((user) => spock.spark.people.get(user.id)))
            .then((peopleResponse) => {
              assert.equal(peopleResponse.length, 6);
              assert.calledOnce(spock.spark.people.batcher.submitHttpRequest);
              spock.spark.people.batcher.submitHttpRequest.restore();
            });
        });

        it('batches people get requests into one', () => {
          sinon.spy(spock.spark.people.batcher, 'submitHttpRequest');
          return Promise.all(batchTestUsers.map((user) => spock.spark.people.get(user)))
            .then((peopleResponse) => {
              assert.equal(peopleResponse.length, 6);
              peopleResponse.map((personResponse) => assert.isPerson(personResponse));
              assert.calledOnce(spock.spark.people.batcher.submitHttpRequest);
              spock.spark.people.batcher.submitHttpRequest.restore();
            });
        });


        it('executes network requests for max limit', () => {
          spock.spark.people.config.batcherMaxCalls = 2;
          sinon.spy(spock.spark.people.batcher, 'submitHttpRequest');
          return spock.spark.people.list(batchTestUsers.map((user) => user.id))
            .then((peopleResponse) => {
              assert.equal(peopleResponse.length, 6);
              assert.calledThrice(spock.spark.people.batcher.submitHttpRequest);
              spock.spark.people.batcher.submitHttpRequest.restore();
            });
        });
      });
    });

    describe('#inferPersonId', () => {
      it('infers a person id without a network dip', () => spock.spark.people.get(spock.id)
        .then((me) => assert.equal(spock.spark.people.inferPersonIdFromUuid(spock.id), me.id)));
    });
  });
});
