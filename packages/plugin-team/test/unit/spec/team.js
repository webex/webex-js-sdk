/**!
 *
 * Copright(c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';
import Team from '../..';
import User from '@ciscospark/plugin-user';

describe(`plugin-team`, () => {
  describe(`Team`, () => {
    let spark;

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          team: Team,
          user: User
        }
      });

      spark.user.recordUUID = sinon.spy();
    });

    describe(`#create()`, () => {
      it(`requires a displayName`, () => assert.isRejected(spark.team.create({}), /\`params.displayName\` is required/));

      it(`requires a participants attribute`, () => assert.isRejected(spark.team.create({displayName: `test`}), /\`params.participants\` is required/));

      it(`requires a participants array`, () => assert.isRejected(spark.team.create({displayName: `test`, participants: []}), /\`params.participants\` is required/));
    });

    describe(`#createConversation()`, () => {
      it(`requires a displayName`, () => assert.isRejected(spark.team.createConversation({}, {}), /\`params.displayName\` is required/));

      it(`requires a team object with a general conversation`, () => assert.isRejected(spark.team.createConversation({}, {displayName: `test`}), /\`team.generalConversationUuid\` must be present/));
    });

    describe(`#prepareTeamConversation()`, () => {
      it(`requires a KRO`, () => assert.isRejected(spark.team._prepareTeamConversation({}), /Error: Team general conversation must have a KRO/));
    });

    describe(`#recordUUIDs`, () => {
      it(`resolves if there are no teamMembers`, () => spark.team._recordUUIDs({})
        .then(() => assert.equal(spark.user.recordUUID.callCount, 0)));

      it(`resolves if there isn't teamMembers.items`, () => spark.team._recordUUIDs({teamMembers: {}})
        .then(() => assert.equal(spark.user.recordUUID.callCount, 0)));
    });
  });
});
