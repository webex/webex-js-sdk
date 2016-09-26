/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import '@ciscospark/plugin-conversation';
import {map, find} from 'lodash';
import testUsers from '@ciscospark/test-helper-test-users';

describe(`plugin-flag`, function() {
  this.timeout(60000);
  describe(`Flag`, () => {
    let flagConversation, mccoy, participants, spock;

    beforeEach(() => testUsers.create({count: 2})
      .then((users) => {
        participants = [mccoy, spock] = users;
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
      })
      .then(() => spock.spark.device.register())
      .then(() => mccoy.spark.device.register())
      .then(() => {
        return spock.spark.conversation.create({
          displayName: `Test Flagging Room`,
          participants
        });
      })
      .then((c) => {
        flagConversation = c;
        return mccoy.spark.conversation.post(flagConversation, {
          displayName: `Hi Dear, How are you?`
        });
      })
      .then(() => {
        return spock.spark.conversation.post(flagConversation, {
          displayName: `Hey! I am doing well. How are you?`
        });
      })
      .then(() => {
        return mccoy.spark.conversation.post(flagConversation, {
          displayName: `I am also doing well. Are you in for the party?`
        });
      })
      .then(() => {
        return spock.spark.conversation.post(flagConversation, {
          displayName: `Yes, I am in.`
        });
      })
      .then(() => {
        assert.isDefined(flagConversation);
        const params = {
          activitiesLimit: 30,
          defaultActivityEncryptionKeyUrl: flagConversation.defaultActivityEncryptionKeyUrl,
          includeParticipants: true,
          kmsResourceObjectUrl: flagConversation.kmsResourceObjectUrl,
          url: flagConversation.url
        };
        return spock.spark.conversation.get(flagConversation, params);
      })
      .then((conversation) => {
        // Removes the "create" activity.
        conversation.activities.items.shift();
        const comments = map(conversation.activities.items, `object.displayName`);
        assert.lengthOf(comments, 4);
        assert.equal(comments[0], `Hi Dear, How are you?`);
        assert.equal(comments[1], `Hey! I am doing well. How are you?`);
        assert.equal(comments[2], `I am also doing well. Are you in for the party?`);
        assert.equal(comments[3], `Yes, I am in.`);
        flagConversation = conversation;
      })
    );


    afterEach(() => {
      return spock.spark.flag.list()
        .then((flags) => {
          flags.forEach((flag) => {
            return spock.spark.flag.remove(flag);
          });
        });
    });

    describe(`#flag()`, () => {
      it(`flags the activity`, () => {
        assert(true);
        const flaggedActivity1 = flagConversation.activities.items[1];
        return spock.spark.flag.flag(flaggedActivity1)
          .then((flagResponse1) => {
            assert.equal(flagResponse1.state, `flagged`);
          });
      });
    });

    describe(`#list()`, () => {
      it(`fetches the flag list`, () => {
        return spock.spark.flag.list()
          .then((flagList) => {
            assert.isArray(flagList);
            assert.lengthOf(flagList, 0);
          });
      });
    });

    describe(`#mapToActivities()`, () => {
      it(`maps flags to activity`, () => {
        const flaggedActivity1 = flagConversation.activities.items[1];
        return spock.spark.flag.flag(flaggedActivity1)
          .then((flagResponse1) => {
            assert.equal(flagResponse1.state, `flagged`);
            const flags = [];
            flags.push(flagResponse1);
            return spock.spark.flag.mapToActivities(flags)
              .then((activities) => {
                const activity = activities[0];
                assert.equal(activity.object.displayName, `Hey! I am doing well. How are you?`);
                assert.isDefined(find(activities, {url: flagResponse1['flag-item']}));
              });
          });
      });
    });

    describe(`#remove()`, () => {
      it(`removes the flag from activity`, () => {
        const flaggedActivity1 = flagConversation.activities.items[1];
        return spock.spark.flag.flag(flaggedActivity1)
          .then((flagResponse1) => {
            assert.equal(flagResponse1.state, `flagged`);
            return spock.spark.flag.remove(flagResponse1);
          })
          .then(() => spock.spark.flag.list())
          .then((flagList) => {
            assert.isArray(flagList);
            assert.lengthOf(flagList, 0);
          });
      });
    });

    describe(`#archive()`, () => {
      it(`archives the flag for an activity`, () => {
        const flaggedActivity1 = flagConversation.activities.items[1];
        return spock.spark.flag.flag(flaggedActivity1)
          .then((flagResponse1) => {
            assert.equal(flagResponse1.state, `flagged`);
            return spock.spark.flag.archive(flagResponse1);
          })
          .then((response) => {
            assert.equal(response.state, `archived`);
          });
      });
    });

    describe(`#unflag()`, () => {
      it(`unflag the flag for an activity`, () => {
        const flaggedActivity1 = flagConversation.activities.items[1];
        return spock.spark.flag.flag(flaggedActivity1)
          .then((flagResponse1) => {
            assert.equal(flagResponse1.state, `flagged`);
            return spock.spark.flag.unflag(flagResponse1);
          })
          .then((response) => {
            assert.equal(response.state, `unflagged`);
          });
      });
    });

  });
});
