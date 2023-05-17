/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
/* eslint-disable no-underscore-dangle */
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Conversation from '@webex/internal-plugin-conversation';

import {
  rootActivityManager,
  getLoopCounterFailsafe,
  noMoreActivitiesManager,
  bookendManager,
  activityManager,
} from '../../../src/activity-thread-ordering';
import {ACTIVITY_TYPES, getActivityType, OLDER, NEWER} from '../../../src/activities';

describe('plugin-conversation', () => {
  describe('Conversation', () => {
    let webex;

    const convoUrl = 'https://conv-test.wbx2.com/conversation';

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          conversation: Conversation,
        },
      });

      webex.internal.services = {};
      webex.internal.services.get = sinon.stub().returns(Promise.resolve(convoUrl));
      webex.internal.services.getServiceUrlFromClusterId = sinon.stub().returns(convoUrl);
    });

    describe('processInmeetingchatEvent()', () => {
      beforeEach(() => {
        webex.transform = sinon.stub().callsFake((obj) => Promise.resolve(obj));
      });

      it('calls transform with correct arguments', async () => {
        const event = {name: 'test-event'};

        await webex.internal.conversation.processInmeetingchatEvent(event);

        assert.calledWith(webex.transform, 'inbound', event);
      });

      it('calls transform and returns event', async () => {
        const event = {name: 'test-event'};
        const returnValue = await webex.internal.conversation.processInmeetingchatEvent(event);

        assert.equal(event, returnValue);
      });
    });

    describe('#_inferConversationUrl', () => {
      const testConvo = {test: 'convo'};

      it('Returns given convo if no id', () =>
        webex.internal.conversation._inferConversationUrl(testConvo).then((convo) => {
          assert.notCalled(webex.internal.feature.getFeature);
          assert.notCalled(webex.internal.services.get);
          assert.equal(convo.test, 'convo');
        }));

      describe('HA is disabled', () => {
        beforeEach(() => {
          webex.internal.feature.getFeature = sinon.stub().returns(Promise.resolve(false));
          testConvo.id = 'id1';
        });
        it('returns unmodified convo if URL is defined', () => {
          testConvo.url = 'http://example.com';

          return webex.internal.conversation._inferConversationUrl(testConvo).then((convo) => {
            assert.called(webex.internal.feature.getFeature);
            assert.notCalled(webex.internal.services.get);
            assert.equal(convo.url, 'http://example.com');
          });
        });
        it('builds URL if not defined', () => {
          delete testConvo.url;

          return webex.internal.conversation._inferConversationUrl(testConvo).then((convo) => {
            assert.called(webex.internal.feature.getFeature);
            assert.called(webex.internal.services.get);
            assert.equal(convo.url, `${convoUrl}/conversations/id1`);
          });
        });
      });
      describe('HA is enabled', () => {
        beforeEach(() => {
          webex.internal.feature.getFeature = sinon.stub().returns(Promise.resolve(true));
          testConvo.id = 'id1';
        });
        it('builds URL if already defined', () => {
          testConvo.url = 'https://example.com';

          return webex.internal.conversation._inferConversationUrl(testConvo).then((convo) => {
            assert.called(webex.internal.feature.getFeature);
            assert.called(webex.internal.services.get);
            assert.equal(convo.url, `${convoUrl}/conversations/id1`);
          });
        });
        it('builds URL if not defined', () => {
          delete testConvo.url;

          return webex.internal.conversation._inferConversationUrl(testConvo).then((convo) => {
            assert.called(webex.internal.feature.getFeature);
            assert.called(webex.internal.services.get);
            assert.equal(convo.url, `${convoUrl}/conversations/id1`);
          });
        });
      });
    });

    describe('getConvoUrl', () => {
      it('should not return a promise', () => {
        try {
          webex.internal.conversation.getConvoUrl({url: 'convoUrl'}).then();
        } catch (error) {
          assert.equal(
            error.message,
            'webex.internal.conversation.getConvoUrl(...).then is not a function'
          );
        }
      });

      it('should return the url if a url is provided', () => {
        const url = webex.internal.conversation.getConvoUrl({url: convoUrl});

        assert.equal(url, convoUrl);
      });
    });

    describe('#getUrlFromClusterId', () => {
      it('should convert a "us" cluster to WEBEX_CONVERSATION_DEFAULT_CLUSTER cluster', async () => {
        await webex.internal.conversation.getUrlFromClusterId({cluster: 'us'});

        sinon.assert.calledWith(webex.internal.services.getServiceUrlFromClusterId, {cluster: 'us'});
      });

      it('should add the cluster service when missing', async () => {
        await webex.internal.conversation.getUrlFromClusterId({cluster: 'urn:TEAM:us-west-2_r'});

        sinon.assert.calledWith(webex.internal.services.getServiceUrlFromClusterId, {cluster: 'urn:TEAM:us-west-2_r'});
      });
    });

    describe('paginate', () => {
      it('should throw an error if a page is passed with no links', () => {
        webex.internal.conversation.paginate({page: {}}).catch((error) => {
          assert.equal(error.message, 'No link to follow for the provided page');
        });
      });
    });

    describe('#getReactionSummaryByParentId()', () => {
      beforeEach(() => {
        webex.request = sinon.stub().returns(
          Promise.resolve({
            body: {
              children: [
                {type: 'reactionSelfSummary'},
                {type: 'reactionSelfSummary'},
                {type: 'reactionSummary'},
                {type: 'notAReaction'},
              ],
            },
          })
        );
      });

      it('should call request', () =>
        webex.internal.conversation.getReactionSummaryByParentId(convoUrl, 'test-id').then(() => {
          assert.called(webex.request);
        }));

      it('should not retrieve non reaction summary objects', () =>
        webex.internal.conversation
          .getReactionSummaryByParentId(convoUrl, 'test-id')
          .then((result) => {
            assert.equal(result.length, 3);
            assert.notInclude(result, {type: 'notAReaction'});
          }));
    });

    describe('#listAllChildActivitiesByParentId()', () => {
      const options = {
        conversationUrl: convoUrl,
        activityParentId: '123-abc',
        query: {activityType: 'reply'},
      };
      let dayCount = 0;
      const createActivityItemBatch = (itemCount) => {
        const counter = [...Array(itemCount).keys()];

        dayCount += 1;

        return counter.map((n) => ({
          published: new Date(2020, 0, 1, dayCount, n),
        }));
      };

      const createMockChildResponse = (itemsToReturn = 10) => {
        const response = {
          body: {
            items: createActivityItemBatch(itemsToReturn),
          },
          headers: {
            link: '<https://www.cisco.com>; rel=next',
          },
        };

        return response;
      };

      beforeEach(() => {
        webex.request = sinon
          .stub()
          .onCall(0)
          .returns(Promise.resolve(createMockChildResponse()))
          .onCall(1)
          .returns(Promise.resolve(createMockChildResponse()))
          .onCall(2)
          .returns(Promise.resolve(createMockChildResponse(3)))
          .returns(
            Promise.resolve(
              Promise.resolve({
                body: {
                  items: [],
                },
                headers: {},
              })
            )
          );
      });
      it('retrieves correct children count', () =>
        webex.internal.conversation.listAllChildActivitiesByParentId(options).then((res) => {
          assert.equal(res.length, 23);
        }));

      it('calls #listChildActivitiesByParentId() to initiate the request', () => {
        const spy = sinon.spy(webex.internal.conversation, 'listChildActivitiesByParentId');

        return webex.internal.conversation.listAllChildActivitiesByParentId(options).then(() => {
          assert(spy.calledOnce);
        });
      });

      it('returns children in ascending published order', () =>
        webex.internal.conversation.listAllChildActivitiesByParentId(options).then((res) => {
          const firstMessageOlderThanLastMessage = res[0].published < res[res.length - 1].published;

          assert.isTrue(firstMessageOlderThanLastMessage, 'activities out of order');
        }));
    });

    describe('#listActivitiesThreadOrdered()', () => {
      it('should throw an error when called without a conversationUrl option', (done) => {
        try {
          webex.internal.conversation.listActivitiesThreadOrdered({});
        } catch (e) {
          assert.equal(e.message, 'must provide a conversation URL or conversation ID');
          done();
        }
      });

      it('calls #_listActivitiesThreadOrdered()', () => {
        const spy = sinon.spy(webex.internal.conversation, '_listActivitiesThreadOrdered');

        webex.internal.conversation.listActivitiesThreadOrdered({
          conversationUrl: convoUrl,
          includeChildren: true,
        });
        sinon.assert.calledWith(spy, {url: convoUrl, includeChildren: true});
      });

      it('returns expected wrapped functions', () => {
        const functions = webex.internal.conversation.listActivitiesThreadOrdered({
          conversationUrl: convoUrl,
        });

        assert.hasAllKeys(functions, ['jumpToActivity', 'getOlder', 'getNewer']);
      });

      describe('returned functions', () => {
        const returnedVal = [{}, {}, {}, {}];

        beforeEach(() => {
          webex.internal.conversation._listActivitiesThreadOrdered = sinon.stub().returns({
            next() {
              return new Promise((resolve) =>
                resolve({
                  value: returnedVal,
                  next() {},
                })
              );
            },
          });
        });

        it('getOlder() should implement the iterator protocol', () => {
          const {getOlder} = webex.internal.conversation.listActivitiesThreadOrdered({
            conversationUrl: convoUrl,
          });

          return getOlder().then((result) => {
            assert.hasAllKeys(result, ['done', 'value']);
          });
        });

        it('getNewer() should implement the iterator protocol', () => {
          const {getNewer} = webex.internal.conversation.listActivitiesThreadOrdered({
            conversationUrl: convoUrl,
          });

          return getNewer().then((result) => {
            assert.hasAllKeys(result, ['done', 'value']);
          });
        });

        describe('jumpToActivity()', () => {
          it('should throw an error if search object is missing', () => {
            const {jumpToActivity} = webex.internal.conversation.listActivitiesThreadOrdered({
              conversationUrl: convoUrl,
            });

            jumpToActivity().catch((e) => {
              assert.equal(
                e.message,
                'Search must be an activity object from conversation service'
              );
            });
          });

          it('should throw an error if activity.target.url is missing', () => {
            const {jumpToActivity} = webex.internal.conversation.listActivitiesThreadOrdered({
              conversationUrl: convoUrl,
            });

            jumpToActivity({target: null}).catch((e) => {
              assert.equal(e.message, 'Search object must have a target url!');
            });
          });

          it('should implement the iterator protocol', () => {
            const {jumpToActivity} = webex.internal.conversation.listActivitiesThreadOrdered({
              conversationUrl: convoUrl,
            });

            return jumpToActivity({target: {url: 'newUrl'}}).then((result) => {
              assert.hasAllKeys(result, ['done', 'value']);
            });
          });
        });
      });
    });

    describe('activity-thread-ordering helpers', () => {
      const createSimpleActivityByType = (type) => ({
        parent: {
          type,
        },
      });

      describe('getActivityType', () => {
        it('should handle common activity types', () => {
          const reply = createSimpleActivityByType('reply');
          const reaction = {type: 'reactionSummary'};
          const deleteAct = {verb: 'delete'};
          const root = createSimpleActivityByType();

          assert.equal(getActivityType(reply), 'REPLY');
          assert.equal(getActivityType(reaction), 'REACTION');
          assert.equal(getActivityType(deleteAct), 'DELETE');
          assert.equal(getActivityType(root), 'ROOT');
        });
      });

      describe('rootActivityManager', () => {
        it('should return expected exposed functions', () => {
          const functions = rootActivityManager();

          assert.hasAllKeys(functions, ['addNewRoot', 'getRootActivityHash']);
        });

        it('should interface with internal storage object', () => {
          const {addNewRoot, getRootActivityHash} = rootActivityManager();

          const initialRootHash = getRootActivityHash();

          assert.isEmpty(initialRootHash);

          addNewRoot({id: '123'});

          assert.isNotEmpty(initialRootHash);
        });
      });

      describe('getLoopCounterFailsafe', () => {
        it('should throw after looping 100 times', () => {
          let externalCount = 1;
          const incrementLoop = getLoopCounterFailsafe();

          try {
            while (externalCount < 150) {
              externalCount += 1;
              incrementLoop();
            }
          } catch (e) {
            assert.equal(e.message, 'max fetches reached');
          }
        });
      });

      describe('noMoreActivitiesManager', () => {
        let getNoMoreActs, checkAndSetNoMoreActs, checkAndSetNoNewerActs, checkAndSetNoOlderActs;
        const createAct = {verb: 'create'};

        beforeEach(() => {
          const funcs = noMoreActivitiesManager();

          getNoMoreActs = funcs.getNoMoreActs;
          checkAndSetNoMoreActs = funcs.checkAndSetNoMoreActs;
          checkAndSetNoNewerActs = funcs.checkAndSetNoNewerActs;
          checkAndSetNoOlderActs = funcs.checkAndSetNoOlderActs;
        });

        it('should return expected exposed functions', () => {
          const functions = noMoreActivitiesManager();

          assert.hasAllKeys(functions, [
            'getNoMoreActs',
            'checkAndSetNoMoreActs',
            'checkAndSetNoNewerActs',
            'checkAndSetNoOlderActs',
          ]);
        });

        it('should set no more activities when no newer activities exist', () => {
          checkAndSetNoOlderActs({});
          checkAndSetNoNewerActs([]);
          checkAndSetNoMoreActs(NEWER);

          assert.isTrue(getNoMoreActs());
        });

        it('should set no more activities when no older activities exist', () => {
          checkAndSetNoOlderActs(createAct);
          checkAndSetNoNewerActs([]);
          checkAndSetNoMoreActs(OLDER);

          assert.isTrue(getNoMoreActs());
        });

        it('should not set no more activities when newer activities exist', () => {
          checkAndSetNoNewerActs([1, 2, 3]);
          checkAndSetNoOlderActs(createAct);
          checkAndSetNoMoreActs(NEWER);

          assert.isFalse(getNoMoreActs());
        });

        it('should not set no more activities when older activities exist', () => {
          checkAndSetNoNewerActs([]);
          checkAndSetNoOlderActs({});
          checkAndSetNoMoreActs(OLDER);

          assert.isFalse(getNoMoreActs());
        });
      });

      describe('bookendManager', () => {
        let setBookends, getNewestAct, getOldestAct;
        const createDateISO = (min) => new Date(1, 1, 1, 1, min).toISOString();

        beforeEach(() => {
          const funcs = bookendManager();

          setBookends = funcs.setBookends;
          getNewestAct = funcs.getNewestAct;
          getOldestAct = funcs.getOldestAct;
        });

        it('should return expected exposed functions', () => {
          const functions = bookendManager();

          assert.hasAllKeys(functions, ['setBookends', 'getNewestAct', 'getOldestAct']);
        });

        it('should set the oldest and newest activity in a batch', () => {
          const acts = [
            {published: createDateISO(1), order: 0},
            {published: createDateISO(2), order: 1},
          ];

          setBookends(acts);
          assert.equal(getOldestAct().order, 0);
          assert.equal(getNewestAct().order, 1);
        });

        it('should bookends when newer and older activities exists', () => {
          const acts = [
            {published: createDateISO(5), order: 2},
            {published: createDateISO(6), order: 3},
          ];

          setBookends(acts);

          const nextActs = [
            {published: createDateISO(1), order: 1},
            {published: createDateISO(9), order: 4},
          ];

          setBookends(nextActs);

          assert.equal(getOldestAct().order, 1);
          assert.equal(getNewestAct().order, 4);
        });

        it('should not update oldest activity when only newer activities exist', () => {
          const acts = [
            {published: createDateISO(1), order: 1},
            {published: createDateISO(5), order: 2},
          ];

          setBookends(acts);

          const nextActs = [
            {published: createDateISO(6), order: 3},
            {published: createDateISO(9), order: 4},
          ];

          setBookends(nextActs);

          assert.equal(getOldestAct().order, 1);
          assert.equal(getNewestAct().order, 4);
        });
      });

      describe('activityManager', () => {
        let getActivityHandlerByKey, getActivityByTypeAndParentId;
        const parentId = 'parentId';
        const parentId2 = 'parentId2';

        beforeEach(() => {
          const funcs = activityManager();

          getActivityHandlerByKey = funcs.getActivityHandlerByKey;
          getActivityByTypeAndParentId = funcs.getActivityByTypeAndParentId;
        });

        it('should return expected exposed functions', () => {
          const functions = activityManager();

          assert.hasAllKeys(functions, ['getActivityHandlerByKey', 'getActivityByTypeAndParentId']);
        });

        it('should handle new replies', () => {
          const replyAct = {
            id: '1',
            activityType: 'reply',
            parent: {
              id: parentId,
            },
          };
          const replyHandler = getActivityHandlerByKey(ACTIVITY_TYPES.REPLY);

          replyHandler(replyAct);

          const replyMap = getActivityByTypeAndParentId(ACTIVITY_TYPES.REPLY, parentId);

          assert.equal(replyMap.get('1'), replyAct);

          const secondReplyAct = {
            id: '2',
            activityType: 'reply',
            parent: {
              id: parentId,
            },
          };

          replyHandler(secondReplyAct);

          assert.equal(replyMap.get('2'), secondReplyAct);

          const thirdReply = {
            id: '3',
            activityType: 'reply',
            parent: {
              id: parentId2,
            },
          };

          replyHandler(thirdReply);

          const replyMap2 = getActivityByTypeAndParentId(ACTIVITY_TYPES.REPLY, parentId2);

          assert.equal(replyMap2.get('3'), thirdReply);
        });

        it('should handle edits', () => {
          const editHandler = getActivityHandlerByKey(ACTIVITY_TYPES.EDIT);

          const editAct = {
            id: 'editId1',
            parent: {
              id: parentId,
              type: 'edit',
            },
            published: new Date(1, 1, 1, 1, 1).toISOString(),
          };
          const tombstoneEdit = {
            ...editAct,
            verb: ACTIVITY_TYPES.TOMBSTONE,
          };
          const newerEdit = {
            ...editAct,
            published: new Date(1, 1, 1, 1, 3).toISOString(),
          };

          editHandler(editAct);

          assert.equal(getActivityByTypeAndParentId(ACTIVITY_TYPES.EDIT, parentId), editAct);

          editHandler(tombstoneEdit);

          assert.equal(getActivityByTypeAndParentId(ACTIVITY_TYPES.EDIT, parentId), editAct);

          editHandler(newerEdit);

          assert.equal(getActivityByTypeAndParentId(ACTIVITY_TYPES.EDIT, parentId), newerEdit);
        });

        it('should handle reactions', () => {
          const reactionHandler = getActivityHandlerByKey(ACTIVITY_TYPES.REACTION);
          const reaction = {
            id: 'reaction1',
            published: new Date(1, 1, 1, 1, 1).toISOString(),
            type: 'reactionSummary',
            parent: {
              id: parentId,
            },
          };

          const newerReaction = {
            ...reaction,
            published: new Date(1, 1, 1, 1, 3).toISOString(),
          };

          reactionHandler(reaction);

          assert.equal(getActivityByTypeAndParentId(ACTIVITY_TYPES.REACTION, parentId), reaction);

          reactionHandler(newerReaction);

          assert.equal(
            getActivityByTypeAndParentId(ACTIVITY_TYPES.REACTION, parentId),
            newerReaction
          );
        });
      });
    });

    describe('#_createParsedServerActivity()', () => {
      const activities = {
        root1: {
          id: 'root1',
        },
        reply1: {
          id: 'reply1',
          activityType: 'reply',
          parent: {
            id: 1,
            type: 'reply',
          },
        },
      };

      it('should add editParent field to valid edit activity', () => {
        const activity = {
          id: 'edit1',
          parent: {
            id: 'root1',
            type: 'edit',
          },
        };

        const parsedActivity = webex.internal.conversation._createParsedServerActivity(
          activity,
          activities
        );

        assert.containsAllKeys(parsedActivity, ['editParent']);
      });

      it('should add replyParent field to valid reply activity', () => {
        const activity = {
          id: 'reply2',
          activityType: 'reply',
          parent: {
            id: 'root1',
            type: 'reply',
          },
        };

        const parsedActivity = webex.internal.conversation._createParsedServerActivity(
          activity,
          activities
        );

        assert.containsAllKeys(parsedActivity, ['replyParent']);
      });

      it('should add replyParent and editParent to valid edited reply activity', () => {
        const activity = {
          id: 'replyEdit1',
          parent: {
            id: 'reply1',
            type: 'edit',
          },
        };

        const parsedActivity = webex.internal.conversation._createParsedServerActivity(
          activity,
          activities
        );

        assert.containsAllKeys(parsedActivity, ['replyParent', 'editParent']);
      });

      it('should throw when passed in activity has no parent in activity hash', () => {
        const activity = {
          id: 'throwAct1',
          parent: {
            id: 'root2',
          },
        };

        try {
          assert.throws(
            webex.internal.conversation._createParsedServerActivity(activity, activities)
          );
        } catch (e) {
          // swallow error
        }
      });
    });

    describe('delete()', () => {
      const testConvo = {
        id: 'id1',
        url: 'https://example.com',
      };

      it('should reject if provided param is not an object', () => {
        const request = webex.internal.conversation.delete(testConvo, 'hello');

        return request
          .then(() => {
            assert.equal(true, false, 'should have rejected');
          })
          .catch(() => {
            assert.equal(true, true, 'object is not type object, rejects as expected');
          });
      });
      it('deletes a non-meeting container activity', () => {
        webex.internal.conversation.prepare = sinon
          .stub()
          .callsFake((activity, request) => Promise.resolve({activity, request}));
        webex.internal.conversation.submit = sinon.stub().callsFake((p) => Promise.resolve(p));

        // fix this to look like below
        const request = webex.internal.conversation.delete(
          testConvo,
          {
            id: 'activity-id-1',
            url: 'https://example.com/activity1',
            object: {objectType: 'activity'},
          },
          {
            object: {objectType: 'activity'},
          }
        );

        return request.then(({request}) => {
          assert.isUndefined(request.kmsMessage);
        });
      });
      it('deletes a meeting container activity', () => {
        webex.internal.conversation.prepare = sinon
          .stub()
          .callsFake((activity, request) => Promise.resolve({activity, request}));
        webex.internal.conversation.submit = sinon.stub().callsFake((p) => Promise.resolve(p));

        const request = webex.internal.conversation.delete(
          testConvo,
          {
            id: 'activity-id-2',
            url: 'https://example.com/activity2',
            object: {
              kmsResourceObjectUrl: 'kms://example',
              objectType: 'meetingContainer',
            },
          },
          {
            object: {
              objectType: 'meetingContainer',
            },
          }
        );

        return request.then(({request}) => {
          assert.equal(request.kmsMessage.method, 'delete');
          assert.equal(request.kmsMessage.uri, '<KRO>/authorizations?authId=');
          assert.equal(request.target.kmsResourceObjectUrl, 'kms://example');
        });
      });
    });
  });
});
