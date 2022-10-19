/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {InvalidUserCreation} from '@webex/internal-plugin-conversation';
import {patterns} from '@webex/common';
import WebexCore, {WebexHttpError} from '@webex/webex-core';
import {assert} from '@webex/test-helper-chai';
import testUsers from '@webex/test-helper-test-users';
import {find, last, map} from 'lodash';
import uuid from 'uuid';
import fh from '@webex/test-helper-file';

describe('plugin-conversation', function () {
  this.timeout(60000);
  describe('#create()', () => {
    let checkov, kirk, mccoy, participants, webex, spock;
    let sampleTextOne = 'sample-text-one.txt';

    before(async () => {
      [spock, mccoy, checkov, kirk] = await testUsers.create({count: 4});
      participants = [spock, mccoy, checkov];

      // Pause for 5 seconds for CI
      await new Promise((done) => setTimeout(done, 5000));

      webex = new WebexCore({
        credentials: {
          authorization: spock.token
        }
      });

      webex.config.conversation.allowedOutboundTags = {
        strong: []
      };
      webex.config.conversation.allowedInboundTags = {
        strong: []
      };

      mccoy.webex = new WebexCore({
        credentials: {
          authorization: mccoy.token
        }
      });

      // eslint-disable-next-line no-unused-expressions
      await webex.internal.mercury.connect();
      await mccoy.webex.internal.mercury.connect();

      sampleTextOne = await fh.fetch(sampleTextOne);
    });

    after(async () => {
      // eslint-disable-next-line no-unused-expressions
      webex && await webex.internal.mercury.disconnect();
      // eslint-disable-next-line no-unused-expressions
      mccoy && await mccoy.webex.internal.mercury.disconnect();
    });

    function makeEmailAddress() {
      return `webex-js-sdk--test-${uuid.v4()}@example.com`;
    }

    describe('when there is only one other participant', () => {
      it('creates a 1:1 conversation', () => webex.internal.conversation.create({participants: [mccoy]})
        .then((conversation) => {
          assert.isConversation(conversation);
          assert.isOneOnOneConversation(conversation);
          assert.isNewEncryptedConversation(conversation);

          assert.lengthOf(conversation.participants.items, 2);
          assert.lengthOf(conversation.activities.items, 1);
        }));

      // TODO: Issues with side boarding users too soon. Skipping until it's fixed
      describe.skip('when the other user doesn\'t exist', () => {
        let email;

        beforeEach(() => { email = makeEmailAddress(); });

        it('invites the other user', () => webex.internal.conversation.create({participants: [email]})
          .then((conversation) => {
            assert.isConversation(conversation);
            assert.isOneOnOneConversation(conversation);
            assert.isNewEncryptedConversation(conversation);

            const participant = find(conversation.participants.items, {emailAddress: email});

            assert.include(participant.tags, 'SIDE_BOARDED');
            assert.match(participant.id, patterns.uuid);
          }));
      });

      describe('when the conversation already exists', () => {
        describe('with skipOneOnOneFetch=true', () => {
          it('fails to create a 1:1 conversation that already exists', () => assert.isRejected(webex.internal.conversation.create({participants: [mccoy]}, {skipOneOnOneFetch: true}))
            .then((reason) => assert.instanceOf(reason, WebexHttpError.Conflict)));
        });

        it('returns the preexisting conversation', () => webex.internal.conversation.create({participants: [checkov]})
          .then((conversation) => webex.internal.conversation.create({participants: [checkov]})
            .then((conversation2) => {
              assert.equal(conversation2.url, conversation.url);
              assert.lengthOf(conversation.activities.items, 1);
              assert.equal(conversation.activities.items[0].verb, 'create');
            })));

        it('returns the preexisting conversation and posts a comment', () => webex.internal.conversation.create({participants: [checkov], comment: 'hi'})
          .then((conversation) => webex.internal.conversation.create({participants: [checkov]})
            .then((conversation2) => {
              assert.equal(conversation2.id, conversation.id);
              // the first activity is "create"; get the "post"
              const activity = conversation.activities.items.pop();

              assert.equal(activity.verb, 'post');
              assert.equal(activity.object.displayName, 'hi');
            })));

        it('returns the preexisting conversation and posts a comment with html', () => webex.internal.conversation.create({participants: [checkov], comment: '**hi**', html: '<strong>hi</strong>'})
          .then((conversation) => webex.internal.conversation.create({participants: [checkov]})
            .then((conversation2) => {
              assert.equal(conversation2.id, conversation.id);
              // the first activity is "create"; get the "post"
              const activity = conversation.activities.items.pop();

              assert.equal(activity.verb, 'post');
              assert.equal(activity.object.displayName, '**hi**');
              assert.equal(activity.object.content, '<strong>hi</strong>');
            })));
      });

      describe('when {forceGrouped: true} is specified', () => {
        it('creates a grouped conversation @canary', () => webex.internal.conversation.create({participants: [mccoy]}, {forceGrouped: true})
          .then((conversation) => {
            assert.isConversation(conversation);
            assert.isGroupConversation(conversation);
            assert.isNewEncryptedConversation(conversation);

            assert.lengthOf(conversation.participants.items, 2);
            assert.lengthOf(conversation.activities.items, 1);
          }));
      });
    });

    describe('when there is an invalid user in the participants list', () => {
      describe('with allowPartialCreation', () => {
        it('creates a group conversation', () => webex.internal.conversation.create({participants: [mccoy, 'invalidUser']}, {allowPartialCreation: true})
          .then((conversation) => {
            assert.isConversation(conversation);
            assert.isGroupConversation(conversation);
            assert.isNewEncryptedConversation(conversation);

            assert.lengthOf(conversation.participants.items, 2);
            assert.lengthOf(conversation.activities.items, 1);
          }));

        it('creates a group conversation with invalid uuid', () => testUsers.remove([kirk])
          .then(() => webex.internal.conversation.create({participants: [mccoy.id, kirk.id]}, {allowPartialCreation: true}))
          .then((conversation) => {
            assert.isConversation(conversation);
            assert.isGroupConversation(conversation);
            assert.isNewEncryptedConversation(conversation);

            assert.lengthOf(conversation.participants.items, 2);
            assert.lengthOf(conversation.activities.items, 1);
          }));

        it('fails to create a 1:1 conversation', () => assert.isRejected(webex.internal.conversation.create({participants: ['invalidUser']}, {allowPartialCreation: true}))
          .then((reason) => assert.instanceOf(reason, InvalidUserCreation)));
      });

      describe('without allowPartialCreation', () => {
        it('fails to create a group conversation without allowPartialCreation param', () => assert.isRejected(webex.internal.conversation.create({participants: [mccoy, 'invalidUser']})));
      });
    });

    describe('when {compact: ?} is not specified', () => {
      it('creates a compact conversation', () => webex.internal.conversation.create({participants})
        .then((c) => webex.internal.conversation.get(c, {activitiesLimit: 5}))
        .then((c) => assert.lengthOf(c.activities.items, 1)));
    });

    it('creates a conversation with a name', () => webex.internal.conversation.create({displayName: 'displayName', participants})
      .then((c) => webex.internal.conversation.get(c))
      .then((c) => assert.equal(c.displayName, 'displayName')));

    it('creates a conversation with a comment', () => webex.internal.conversation.create({comment: 'comment', participants})
      .then((c) => webex.internal.conversation.get(c, {activitiesLimit: 2}))
      .then((c) => assert.equal(c.activities.items[1].object.displayName, 'comment')));

    it('creates a conversation with a tag', () => webex.internal.conversation.create({tags: ['WELCOME'], participants})
      .then((c) => webex.internal.conversation.get(c, {activitiesLimit: 1}))
      .then((c) => assert.equal(c.tags[0], 'WELCOME')));

    it('creates a favorite conversation', () => webex.internal.conversation.create({favorite: true, participants})
      .then((c) => webex.internal.conversation.get(c, {activitiesLimit: 1}))
      .then((c) => assert.equal(c.tags[0], 'FAVORITE')));

    it('creates a conversation with a comment with html', () => webex.internal.conversation.create({comment: '**comment**', html: '<strong>comment</strong>', participants})
      .then((c) => webex.internal.conversation.get(c, {activitiesLimit: 2}))
      .then((c) => {
        assert.equal(c.activities.items[1].object.displayName, '**comment**');
        assert.equal(c.activities.items[1].object.content, '<strong>comment</strong>');
      }));

    it('creates a conversation with a share', () => webex.internal.conversation.create({participants, files: [sampleTextOne]})
      .then((c) => webex.internal.conversation.get(c, {activitiesLimit: 10}))
      .then((c) => {
        assert.equal(last(c.activities.items).verb, 'share');

        return webex.internal.conversation.download(last(c.activities.items).object.files.items[0]);
      })
      .then((file) => fh.isMatchingFile(file, sampleTextOne)));

    it('ensures the current user is in the participants list', () => webex.internal.conversation.create({comment: 'comment', participants: [mccoy, checkov]})
      .then((c) => webex.internal.conversation.get(c, {includeParticipants: true}))
      .then((c) => assert.include(map(c.participants.items, 'id'), spock.id)));

    it('does not allow me to create a conversation with zero participants', () => assert.isRejected(webex.internal.conversation.create({participants: []}, /`params.participants` is required/)));

    it('does not allow me to create a classified space when feature toggle is disabled for the org', () => webex.internal.conversation.create({participants: [mccoy, checkov], classificationId: 'abcde-12345-Some-UUID'})
      .catch((err) => assert.match(err.toString(), /Org not entitled for space classifications/)));
  });
});
