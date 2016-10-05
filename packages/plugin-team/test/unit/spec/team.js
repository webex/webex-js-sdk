/**!
 *
 * Copright(c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {assert} from '@ciscospark/test-helper-chai';
import Team from '../..';
import MockSpark from '@ciscospark/test-helper-mock-spark';

describe(`plugin-team`, () => {
  describe(`Team`, () => {
    let spark;

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          team: Team
        }
      });
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
  });
});
