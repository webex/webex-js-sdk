/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-conversation';

import WebexCore from '@webex/webex-core';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import testUsers from '@webex/test-helper-test-users';
import fh from '@webex/test-helper-file';
import makeLocalUrl from '@webex/test-helper-make-local-url';
import {map, find, findIndex, findLast} from 'lodash';
import retry from '@webex/test-helper-retry';

const postMessage = (webex, convo) => (msg) =>
  webex.internal.conversation.post(convo, {displayName: msg});

const postReply = (webex, conversation) => (threadObj) =>
  webex.internal.conversation.post(conversation, threadObj.displayName, {
    parentActivityId: threadObj.parentActivityId,
    activityType: 'reply',
  });

const threadDisplayNames = ['thread 1', 'thread 2', 'thread 3'];
const createThreadObjs = (parents) => {
  const threadObjects = [];

  for (const msg of threadDisplayNames) {
    for (const [ix, parentAct] of parents.entries()) {
      // add threads to every other, plus randoms for variability
      if (ix % 2 || Math.round(Math.random())) {
        threadObjects.push({
          displayName: `${parentAct.object.displayName} ${msg}`,
          parentActivityId: parentAct.id,
        });
      }
    }
  }

  return threadObjects;
};

describe('plugin-conversation', function () {
  this.timeout(120000);

  describe('when fetching conversations', () => {
    let kirk, mccoy, participants, scott, webex, spock, suluEU, checkov;

    before('create tests users and connect three to mercury', () =>
      Promise.all([
        testUsers.create({count: 5}),
        testUsers.create({count: 1, config: {orgId: process.env.EU_PRIMARY_ORG_ID}}),
      ]).then(([users, usersEU]) => {
        [spock, mccoy, kirk, scott, checkov] = users;
        [suluEU] = usersEU;
        participants = [spock, mccoy, kirk];

        spock.webex = new WebexCore({
          credentials: {
            supertoken: spock.token,
          },
        });

        webex = spock.webex;

        suluEU.webex = new WebexCore({
          credentials: {
            supertoken: suluEU.token,
          },
        });

        checkov.webex = new WebexCore({
          credentials: {
            supertoken: checkov.token,
          },
        });

        return Promise.all(
          [suluEU, checkov, spock].map((user) =>
            user.webex.internal.services
              .waitForCatalog('postauth')
              .then(() => user.webex.internal.mercury.connect())
          )
        );
      })
    );

    after(() =>
      Promise.all([suluEU, checkov, spock].map((user) => user.webex.internal.mercury.disconnect()))
    );

    describe('#download()', () => {
      let sampleImageSmallOnePng = 'sample-image-small-one.png';

      let conversation, conversationRequestSpy;

      before('create conversation', () =>
        webex.internal.conversation.create({participants}).then((c) => {
          conversation = c;
        })
      );

      before('fetch image fixture', () =>
        fh.fetch(sampleImageSmallOnePng).then((res) => {
          sampleImageSmallOnePng = res;
        })
      );

      beforeEach(() => {
        conversationRequestSpy = sinon.spy(webex.internal.conversation, 'request');
      });

      afterEach(() => conversationRequestSpy.restore());

      it('rejects for invalid options argument', () =>
        webex.internal.conversation
          .share(conversation, [sampleImageSmallOnePng])
          .then((activity) => {
            const item = activity.object.files.items[0];

            item.options = {
              params: {
                allow: 'invalidOption',
              },
            };

            assert.isRejected(webex.internal.conversation.download(item));
          }));

      it('downloads and decrypts an encrypted file', () =>
        webex.internal.conversation
          .share(conversation, [sampleImageSmallOnePng])
          .then((activity) => webex.internal.conversation.download(activity.object.files.items[0]))
          .then((f) =>
            fh.isMatchingFile(f, sampleImageSmallOnePng).then((result) => assert.isTrue(result))
          ));

      it('emits download progress events for encrypted files', () =>
        webex.internal.conversation
          .share(conversation, [sampleImageSmallOnePng])
          .then((activity) => {
            const spy = sinon.spy();

            return webex.internal.conversation
              .download(activity.object.files.items[0])
              .on('progress', spy)
              .then(() => assert.called(spy));
          }));

      it('downloads and decrypts a file without a scr key', () =>
        webex.internal.conversation
          .download({
            scr: {
              loc: makeLocalUrl('/sample-image-small-one.png'),
            },
          })
          .then((f) =>
            fh.isMatchingFile(f, sampleImageSmallOnePng).then((result) => assert.isTrue(result))
          )
          .then(() =>
            conversationRequestSpy.returnValues[0].then((res) => {
              assert.property(res.options.headers, 'cisco-no-http-redirect');
              assert.property(res.options.headers, 'spark-user-agent');
              assert.property(res.options.headers, 'trackingid');
            })
          ));

      it('downloads and decrypts a non-encrypted file', () =>
        webex.internal.conversation
          .download({url: makeLocalUrl('/sample-image-small-one.png')})
          .then((f) =>
            fh.isMatchingFile(f, sampleImageSmallOnePng).then((result) => assert.isTrue(result))
          )
          .then(() =>
            conversationRequestSpy.returnValues[0].then((res) => {
              assert.property(res.options.headers, 'cisco-no-http-redirect');
              assert.property(res.options.headers, 'spark-user-agent');
              assert.property(res.options.headers, 'trackingid');
            })
          ));

      it('downloads non-encrypted file with specific options headers', () =>
        webex.internal.conversation
          .download(
            {url: makeLocalUrl('/sample-image-small-one.png')},
            {
              headers: {
                'cisco-no-http-redirect': null,
                'spark-user-agent': null,
                trackingid: null,
              },
            }
          )
          .then((f) =>
            fh.isMatchingFile(f, sampleImageSmallOnePng).then((result) => assert.isTrue(result))
          )
          .then(() =>
            conversationRequestSpy.returnValues[0].then((res) => {
              assert.isUndefined(res.options.headers['cisco-no-http-redirect']);
              assert.isUndefined(res.options.headers['spark-user-agent']);
              assert.isUndefined(res.options.headers.trackingid);
            })
          ));

      it('emits download progress events for non-encrypted files', () => {
        const spy = sinon.spy();

        return webex.internal.conversation
          .download({url: makeLocalUrl('/sample-image-small-one.png')})
          .on('progress', spy)
          .then((f) =>
            fh.isMatchingFile(f, sampleImageSmallOnePng).then((result) => assert.isTrue(result))
          )
          .then(() => assert.called(spy));
      });

      describe('reads exif data and', () => {
        let fileItem;
        let sampleImagePortraitJpeg = 'Portrait_7.jpg';

        before('fetch image fixture', () =>
          fh.fetch(sampleImagePortraitJpeg).then((res) => {
            sampleImagePortraitJpeg = res;
            sampleImagePortraitJpeg.displayName = 'Portrait_7.jpg';
            sampleImagePortraitJpeg.mimeType = 'image/jpeg';
          })
        );
        it('does not add exif data', () =>
          webex.internal.conversation
            .share(conversation, [sampleImagePortraitJpeg])
            .then((activity) => {
              fileItem = activity.object.files.items[0];

              return webex.internal.conversation.download(fileItem, {shouldNotAddExifData: true});
            })
            .then((f) => {
              assert.equal(fileItem.orientation, undefined);

              return fh.isMatchingFile(f, sampleImagePortraitJpeg);
            })
            .then((result) => assert.isTrue(result)));

        it('adds exif data', () =>
          webex.internal.conversation
            .share(conversation, [sampleImagePortraitJpeg])
            .then((activity) => {
              fileItem = activity.object.files.items[0];

              return webex.internal.conversation.download(fileItem);
            })
            .then((f) => {
              assert.equal(fileItem.orientation, 7);

              return fh.isMatchingFile(f, sampleImagePortraitJpeg);
            })
            .then((result) => assert.isTrue(result)));
      });
    });

    describe('#get()', () => {
      let conversation, conversation2;

      before('create conversations', () =>
        Promise.all([
          webex.internal.conversation.create({participants: [mccoy.id]}).then((c) => {
            conversation = c;
          }),
          webex.internal.conversation.create({participants: [scott.id]}).then((c) => {
            conversation2 = c;
          }),
        ])
      );

      it('retrieves a single conversation by url', () =>
        webex.internal.conversation.get({url: conversation.url}).then((c) => {
          assert.equal(c.id, conversation.id);
          assert.equal(c.url, conversation.url);
        }));

      it('retrieves a single conversation by id', () =>
        webex.internal.conversation.get({id: conversation.id}).then((c) => {
          assert.equal(c.id, conversation.id);
          assert.equal(c.url, conversation.url);
        }));

      it('retrieves a 1:1 conversation by userId', () =>
        webex.internal.conversation.get({user: mccoy}).then((c) => {
          assert.equal(c.id, conversation.id);
          assert.equal(c.url, conversation.url);
        }));

      it('retrieves a 1:1 conversation with a deleted user', () =>
        webex.internal.conversation
          .get({user: scott})
          .then((c) => {
            assert.equal(c.id, conversation2.id);
            assert.equal(c.url, conversation2.url);
          })
          .then(() => testUsers.remove([scott]))
          // add retries to address CI propagation delay
          .then(() =>
            retry(() => assert.isRejected(webex.internal.conversation.get({user: scott})))
          )
          .then(() =>
            retry(() =>
              webex.internal.conversation.get({user: scott}, {includeConvWithDeletedUserUUID: true})
            )
          )
          .then((c) => {
            assert.equal(c.id, conversation2.id);
            assert.equal(c.url, conversation2.url);
          }));

      it('decrypts the contents of activities in the retrieved conversation', () =>
        webex.internal.conversation
          .post(conversation, {
            displayName: 'Test Message',
          })
          .then(() =>
            webex.internal.conversation.get({url: conversation.url}, {activitiesLimit: 50})
          )
          .then((c) => {
            const posts = c.activities.items.filter((activity) => activity.verb === 'post');

            assert.lengthOf(posts, 1);
            assert.equal(posts[0].object.displayName, 'Test Message');
          }));
    });

    describe('#list()', () => {
      let conversation1, conversation2;

      before('create conversations', () =>
        webex.internal.conversation
          .create({
            displayName: 'test 1',
            participants,
          })
          .then((c) => {
            conversation1 = c;
          })
          .then(() =>
            webex.internal.conversation.create({
              displayName: 'test 2',
              participants,
            })
          )

          .then((c) => {
            conversation2 = c;
          })
      );

      it('retrieves a set of conversations', () =>
        webex.internal.conversation
          .list({
            conversationsLimit: 2,
          })
          .then((conversations) => {
            assert.include(map(conversations, 'url'), conversation1.url);
            assert.include(map(conversations, 'url'), conversation2.url);
          }));

      it('retrieves a paginated set of conversations', () =>
        webex.internal.conversation
          .paginate({
            conversationsLimit: 1,
            personRefresh: false,
            paginate: true,
          })
          .then((response) => {
            const conversations = response.page.items;

            assert.lengthOf(conversations, 1);
            assert.equal(conversations[0].displayName, conversation2.displayName);

            return webex.internal.conversation.paginate({page: response.page});
          })
          .then((response) => {
            const conversations = response.page.items;

            assert.lengthOf(conversations, 1);
            assert.equal(conversations[0].displayName, conversation1.displayName);
          }));

      describe('with summary = true (ConversationsSummary)', () => {
        it('retrieves all conversations using conversationsSummary', () =>
          webex.internal.conversation
            .list({
              summary: true,
            })
            .then((conversations) => {
              assert.include(map(conversations, 'url'), conversation1.url);
              assert.include(map(conversations, 'url'), conversation2.url);
            }));

        it('retrieves a set of (1) conversations using conversationsLimit', () =>
          webex.internal.conversation
            .list({
              summary: true,
              conversationsLimit: 1,
            })
            .then((conversations) => {
              assert.lengthOf(conversations, 1);
              assert.include(map(conversations, 'url'), conversation2.url);
              assert.include(map(conversations, 'displayName'), conversation2.displayName);
            }));
      });

      describe('with deferDecrypt = true', () => {
        it('retrieves a non-decrypted set of conversations each with a bound decrypt method', () =>
          webex.internal.conversation
            .list({
              conversationsLimit: 2,
              deferDecrypt: true,
            })
            .then(([c1, c2]) => {
              assert.lengthOf(
                c1.displayName.split('.'),
                5,
                '5 periods implies this is a jwt and not a decrypted string'
              );
              assert.notInclude(['test 1, test 2'], c1.displayName);

              assert.lengthOf(
                c2.displayName.split('.'),
                5,
                '5 periods implies this is a jwt and not a decrypted string'
              );
              assert.notInclude(['test 1, test 2'], c2.displayName);

              return Promise.all([
                c1.decrypt().then(() => assert.notInclude(['test 1, test 2'], c1.displayName)),
                c2.decrypt().then(() => assert.notInclude(['test 1, test 2'], c2.displayName)),
              ]);
            }));
      });

      describe('with deferDecrypt && summary = true', () => {
        it('retrieves a non-decrypted set of conversations each with a bound decrypt method', () =>
          webex.internal.conversation
            .list({
              conversationsLimit: 2,
              deferDecrypt: true,
              summary: true,
            })
            .then(([c1, c2]) => {
              assert.lengthOf(
                c1.displayName.split('.'),
                5,
                '5 periods implies this is a jwt and not a decrypted string'
              );
              assert.notInclude(['test 1, test 2'], c1.displayName);

              assert.lengthOf(
                c2.displayName.split('.'),
                5,
                '5 periods implies this is a jwt and not a decrypted string'
              );
              assert.notInclude(['test 1, test 2'], c2.displayName);

              return Promise.all([
                c1.decrypt().then(() => assert.notInclude(['test 1, test 2'], c1.displayName)),
                c2.decrypt().then(() => assert.notInclude(['test 1, test 2'], c2.displayName)),
              ]);
            }));
      });

      describe('with conversation from remote clusters', () => {
        let conversation3, conversation4;

        before('create conversations in EU cluster', () =>
          Promise.all([
            suluEU.webex.internal.conversation
              .create({
                displayName: 'eu test 1',
                participants,
              })
              .then((c) => {
                conversation3 = c;
              }),
            suluEU.webex.internal.conversation
              .create({
                displayName: 'eu test 2',
                participants: [checkov.id, spock.id],
              })
              .then((c) => {
                conversation4 = c;
              }),
          ])
        );

        it('retrieves local + remote cluster conversations', () =>
          webex.internal.conversation.list().then((conversations) => {
            assert.include(map(conversations, 'url'), conversation1.url);
            assert.include(map(conversations, 'url'), conversation2.url);
            assert.include(map(conversations, 'url'), conversation3.url);
            assert.include(map(conversations, 'url'), conversation4.url);
          }));

        it('retrieves only remote cluter conversations if user does not have any local conversations', () =>
          checkov.webex.internal.conversation.list().then((conversations) => {
            assert.include(map(conversations, 'url'), conversation4.url);
            assert.lengthOf(conversations, 1);
          }));
      });
    });

    describe('#listLeft()', () => {
      let conversation;

      before('create conversation', () =>
        webex.internal.conversation.create({participants}).then((c) => {
          conversation = c;
        })
      );

      it('retrieves the conversations the current user has left', () =>
        webex.internal.conversation
          .listLeft()
          .then((c) => {
            assert.lengthOf(c, 0);

            return webex.internal.conversation.leave(conversation);
          })
          .then(() => webex.internal.conversation.listLeft())
          .then((c) => {
            assert.lengthOf(c, 1);
            assert.equal(c[0].id, conversation.id);
          }));
    });

    describe('#listActivities()', () => {
      let conversation;

      before('create conversation with activity', () =>
        webex.internal.conversation.create({participants}).then((c) => {
          conversation = c;
          assert.lengthOf(conversation.participants.items, 3);

          return webex.internal.conversation.post(conversation, {displayName: 'first message'});
        })
      );

      it('retrieves activities for the specified conversation', () =>
        webex.internal.conversation
          .listActivities({conversationUrl: conversation.url})
          .then((activities) => {
            assert.isArray(activities);
            assert.lengthOf(activities, 2);
          }));
    });

    describe('#listThreads()', () => {
      let webex2;

      before('connect mccoy to mercury', () => {
        webex2 = new WebexCore({
          credentials: {
            authorization: mccoy.token,
          },
        });

        return webex2.internal.mercury.connect();
      });

      after(() => webex2 && webex2.internal.mercury.disconnect());

      let conversation;
      let parent;

      before('create conversation', () =>
        webex.internal.conversation.create({participants}).then((c) => {
          conversation = c;
          assert.lengthOf(conversation.participants.items, 3);

          return webex2.internal.conversation
            .post(conversation, {displayName: 'first message'})
            .then((parentActivity) => {
              parent = parentActivity;
            });
        })
      );

      it('retrieves threads()', () =>
        webex2.internal.conversation
          .post(conversation, 'thread1', {
            parentActivityId: parent.id,
            activityType: 'reply',
          })
          .then(() => webex2.internal.conversation.listThreads())
          .then((thread) => {
            assert.equal(thread.length, 1);
            const firstThread = thread[0];

            assert.equal(firstThread.childType, 'reply');
            assert.equal(firstThread.parentActivityId, parent.id);
            assert.equal(firstThread.conversationId, conversation.id);
            assert.equal(firstThread.childActivities.length, 1);

            const childActivity = firstThread.childActivities[0];

            assert.equal(childActivity.objectType, 'activity');
            assert.equal(childActivity.object.displayName, 'thread1');
          }));
    });

    describe('#listMentions()', () => {
      let webex2;

      before('connect mccoy to mercury', () => {
        webex2 = new WebexCore({
          credentials: {
            authorization: mccoy.token,
          },
        });

        return webex2.internal.mercury.connect();
      });

      after(() => webex2 && webex2.internal.mercury.disconnect());

      let conversation;

      before('create conversation', () =>
        webex.internal.conversation.create({participants}).then((c) => {
          conversation = c;
          assert.lengthOf(conversation.participants.items, 3);
        })
      );

      it('retrieves activities in which the current user was mentioned', () =>
        webex2.internal.conversation
          .post(conversation, {
            displayName: 'Green blooded hobgloblin',
            content: `<webex-mention data-object-type="person" data-object-id="${spock.id}">Green blooded hobgloblin</webex-mention>`,
            mentions: {
              items: [
                {
                  id: `${spock.id}`,
                  objectType: 'person',
                },
              ],
            },
          })
          .then((activity) =>
            webex.internal.conversation
              .listMentions({sinceDate: Date.parse(activity.published) - 1})
              .then((mentions) => {
                assert.lengthOf(mentions, 1);
                assert.equal(mentions[0].url, activity.url);
              })
          ));
    });

    // TODO: add testing for bulk_activities_fetch() with clusters later
    describe('#bulkActivitiesFetch()', () => {
      let jenny, maria, dan, convo1, convo2, euConvo1;
      let webex3;

      before('create tests users and connect one to mercury', () =>
        testUsers.create({count: 4}).then((users) => {
          [jenny, maria, dan] = users;

          webex3 = new WebexCore({
            credentials: {
              authorization: jenny.token,
            },
          });

          return webex3.internal.mercury.connect();
        })
      );

      after(() => webex3 && webex3.internal.mercury.disconnect());

      before('create conversation 1', () =>
        webex3.internal.conversation.create({participants: [jenny, maria]}).then((c1) => {
          convo1 = c1;
        })
      );

      before('create conversation 2', () =>
        webex3.internal.conversation.create({participants: [jenny, dan]}).then((c2) => {
          convo2 = c2;
        })
      );

      before('create conversations in EU cluster', () =>
        suluEU.webex.internal.conversation
          .create({
            displayName: 'eu test 1',
            participants: [jenny, suluEU, dan],
          })
          .then((c) => {
            euConvo1 = c;
          })
      );

      before('add comments to convo1, and check post requests successfully went through', () =>
        webex3.internal.conversation
          .post(convo1, {displayName: 'BAGELS (O)'})
          .then((c1) => {
            assert.equal(c1.object.displayName, 'BAGELS (O)');

            return webex3.internal.conversation.post(convo1, {displayName: 'Cream Cheese'});
          })
          .then((c2) => {
            assert.equal(c2.object.displayName, 'Cream Cheese');
          })
      );

      before('add comments to convo2, and check post requests successfully went through', () =>
        webex3.internal.conversation
          .post(convo2, {displayName: 'Want to head to lunch soon?'})
          .then((c1) => {
            assert.equal(c1.object.displayName, 'Want to head to lunch soon?');

            return webex3.internal.conversation.post(convo2, {displayName: 'Sure :)'});
          })
          .then((c2) => {
            assert.equal(c2.object.displayName, 'Sure :)');

            return webex3.internal.conversation.post(convo2, {displayName: 'where?'});
          })
          .then((c3) => {
            assert.equal(c3.object.displayName, 'where?');

            return webex3.internal.conversation.post(convo2, {displayName: 'Meekong Bar!'});
          })
          .then((c4) => {
            assert.equal(c4.object.displayName, 'Meekong Bar!');
          })
      );

      before('add comments to euConvo1, and check post requests successfully went through', () =>
        suluEU.webex.internal.conversation.post(euConvo1, {displayName: 'Hello'}).then((c1) => {
          assert.equal(c1.object.displayName, 'Hello');
        })
      );

      it('retrieves activities from a single conversation', () =>
        webex3.internal.conversation
          .listActivities({conversationUrl: convo1.url})
          .then((convoActivities) => {
            const activityURLs = [];
            const expectedActivities = [];

            convoActivities.forEach((a) => {
              if (a.verb === 'post') {
                activityURLs.push(a.url);
                expectedActivities.push(a);
              }
            });

            return webex3.internal.conversation
              .bulkActivitiesFetch(activityURLs)
              .then((bulkFetchedActivities) => {
                assert.lengthOf(bulkFetchedActivities, expectedActivities.length);
                assert.equal(
                  bulkFetchedActivities[0].object.displayName,
                  expectedActivities[0].object.displayName
                );
                assert.equal(
                  bulkFetchedActivities[1].object.displayName,
                  expectedActivities[1].object.displayName
                );
              });
          }));

      it('retrieves activities from multiple conversations', () => {
        const activityURLs = [];
        const expectedActivities = [];

        return webex3.internal.conversation
          .listActivities({conversationUrl: convo1.url})
          .then((convo1Activities) => {
            // gets all post activity urls from convo1
            convo1Activities.forEach((a1) => {
              if (a1.verb === 'post') {
                activityURLs.push(a1.url);
                expectedActivities.push(a1);
              }
            });

            return webex3.internal.conversation.listActivities({conversationUrl: convo2.url});
          })
          .then((convo2Activities) => {
            // gets activity urls of only comment 3 and 4 from convo2
            [3, 4].forEach((i) => {
              activityURLs.push(convo2Activities[i].url);
              expectedActivities.push(convo2Activities[i]);
            });

            return webex3.internal.conversation
              .bulkActivitiesFetch(activityURLs)
              .then((bulkFetchedActivities) => {
                assert.lengthOf(bulkFetchedActivities, expectedActivities.length);
                assert.equal(
                  bulkFetchedActivities[0].object.displayName,
                  expectedActivities[0].object.displayName
                );
                assert.equal(
                  bulkFetchedActivities[1].object.displayName,
                  expectedActivities[1].object.displayName
                );
                assert.equal(
                  bulkFetchedActivities[2].object.displayName,
                  expectedActivities[2].object.displayName
                );
                assert.equal(
                  bulkFetchedActivities[3].object.displayName,
                  expectedActivities[3].object.displayName
                );
              });
          });
      });

      it('given a activity url that does not exist, should return []', () => {
        const mockURL =
          'https://conversation-intb.ciscospark.com/conversation/api/v1/activities/6d8c7c90-a770-11e9-bcfb-6616ead99ac3';

        webex3.internal.conversation
          .bulkActivitiesFetch([mockURL])
          .then((bulkFetchedActivities) => {
            assert.equal(bulkFetchedActivities, []);
          });
      });

      it('retrieves activities from multiple conversations passing in base convo url', () => {
        const activityURLs = [];
        const expectedActivities = [];

        return webex3.internal.conversation
          .listActivities({conversationUrl: convo1.url})
          .then((convo1Activities) => {
            // gets all post activity urls from convo1
            convo1Activities.forEach((a1) => {
              if (a1.verb === 'post') {
                activityURLs.push(a1.url);
                expectedActivities.push(a1);
              }
            });

            return webex3.internal.conversation.listActivities({conversationUrl: convo2.url});
          })
          .then((convo2Activities) => {
            // gets activity urls of only comment 3 and 4 from convo2
            [3, 4].forEach((i) => {
              activityURLs.push(convo2Activities[i].url);
              expectedActivities.push(convo2Activities[i]);
            });

            return webex3.internal.conversation
              .bulkActivitiesFetch(activityURLs, undefined, {url: process.env.CONVERSATION_SERVICE})
              .then((bulkFetchedActivities) => {
                assert.lengthOf(bulkFetchedActivities, expectedActivities.length);
                assert.equal(
                  bulkFetchedActivities[0].object.displayName,
                  expectedActivities[0].object.displayName
                );
                assert.equal(
                  bulkFetchedActivities[1].object.displayName,
                  expectedActivities[1].object.displayName
                );
                assert.equal(
                  bulkFetchedActivities[2].object.displayName,
                  expectedActivities[2].object.displayName
                );
                assert.equal(
                  bulkFetchedActivities[3].object.displayName,
                  expectedActivities[3].object.displayName
                );
              });
          });
      });

      it('retrieves activities from conversations passing in base convo url from another cluster', () => {
        const activityURLs = [];
        const expectedActivities = [];

        return webex3.internal.conversation
          .listActivities({conversationUrl: euConvo1.url})
          .then((euConvo1Activities) => {
            const convoUrlRegex = /(.*)\/activities/;

            activityURLs.push(euConvo1Activities[1].url);
            expectedActivities.push(euConvo1Activities[1]);
            const match = convoUrlRegex.exec(euConvo1Activities[1].url);
            const convoUrl = match[1];

            return webex3.internal.conversation.bulkActivitiesFetch(activityURLs, {url: convoUrl});
          })
          .then((bulkFetchedActivities) => {
            assert.lengthOf(bulkFetchedActivities, 1);
            assert.equal(
              bulkFetchedActivities[0].object.displayName,
              expectedActivities[0].object.displayName
            );
          });
      });
    });

    describe('#listParentActivityIds', () => {
      let conversation, parent;

      beforeEach('create conversation with activity', () =>
        webex.internal.conversation
          .create({participants})
          .then((c) => {
            conversation = c;

            return webex.internal.conversation.post(conversation, {displayName: 'first message'});
          })
          .then((parentAct) => {
            parent = parentAct;
          })
      );

      it('retrieves parent IDs for thread parents()', () =>
        webex.internal.conversation
          .post(
            conversation,
            {displayName: 'first thread reply'},
            {
              parentActivityId: parent.id,
              activityType: 'reply',
            }
          )
          .then(({parent: parentObj} = {}) => {
            assert.equal(parentObj.type, 'reply');
            assert.equal(parentObj.id, parent.id);

            return webex.internal.conversation.listParentActivityIds(conversation.url, {
              activityType: 'reply',
            });
          })
          .then(({reply}) => {
            assert.include(reply, parent.id);
          }));

      it('retrieves parent IDs for edits', () =>
        webex.internal.conversation
          .post(conversation, 'edited', {
            parent: {
              id: parent.id,
              type: 'edit',
            },
          })
          .then((edit) => {
            assert.equal(edit.parent.type, 'edit');
            assert.equal(edit.parent.id, parent.id);

            return webex.internal.conversation.listParentActivityIds(conversation.url, {
              activityType: 'edit',
            });
          })
          .then(({edit}) => {
            assert.include(edit, parent.id);
          }));

      it('retrieves parent IDs for reactions', () =>
        webex.internal.conversation
          .addReaction(conversation, 'heart', parent)
          .then((reaction) => {
            assert.equal(reaction.parent.type, 'reaction');
            assert.equal(reaction.parent.id, parent.id);

            return webex.internal.conversation.listParentActivityIds(conversation.url, {
              activityType: 'reaction',
            });
          })
          .then(({reaction}) => {
            assert.include(reaction, parent.id);
          }));
    });

    describe('#listChildActivitiesByParentId()', () => {
      let conversation, parent;
      let replies;

      before('create conversation with thread replies', () =>
        webex.internal.conversation
          .create({participants})
          .then((c) => {
            conversation = c;

            return webex.internal.conversation.post(conversation, {displayName: 'first message'});
          })
          .then((parentAct) => {
            parent = parentAct;

            const messages = ['thread 1', 'thread 2', 'thread 3'];

            return Promise.all(
              messages.map((msg) =>
                webex.internal.conversation.post(conversation, msg, {
                  parentActivityId: parent.id,
                  activityType: 'reply',
                })
              )
            );
          })
          .then((repliesArr) => {
            replies = repliesArr;
          })
      );

      it('retrieves thread reply activities for a given parent', () =>
        webex.internal.conversation
          .listChildActivitiesByParentId(conversation.url, parent.id, 'reply')
          .then((response) => {
            const {items} = response.body;

            items.forEach((threadAct) => {
              assert.include(
                replies.map((reply) => reply.id),
                threadAct.id
              );
            });
          }));
    });

    describe('#_listActivitiesThreadOrdered', () => {
      let conversation, firstParentBatch, secondParentBatch, getOlder, jumpToActivity;

      const minActivities = 10;
      const displayNames = [
        'first message',
        'second message',
        'third message',
        'fourth message',
        'fifth message',
        'sixth message',
        'seventh message',
        'eighth message',
        'ninth message',
      ];

      const initializeGenerator = () =>
        webex.internal.conversation.listActivitiesThreadOrdered({
          conversationUrl: conversation.url,
          minActivities,
        });

      before(() =>
        webex.internal.conversation
          .create({participants})
          .then((c) => {
            conversation = c;

            return c;
          })
          .then((c) => Promise.all(displayNames.slice(0, 5).map(postMessage(webex, c))))
          .then((parents) => {
            firstParentBatch = parents;

            return Promise.all(createThreadObjs(parents).map(postReply(webex, conversation)));
          })
          .then(() => Promise.all(displayNames.slice(4).map(postMessage(webex, conversation))))
          .then((parents) => {
            secondParentBatch = parents;

            return Promise.all(createThreadObjs(parents).map(postReply(webex, conversation)));
          })
      );

      beforeEach(() => {
        const funcs = initializeGenerator();

        getOlder = funcs.getOlder;
        jumpToActivity = funcs.jumpToActivity;
      });

      it('should return more than or exactly N minimum activities', () =>
        getOlder().then(({value}) => {
          assert.isAtLeast(value.length, minActivities);
        }));

      it('should return edit activity ID as activity ID when an activity has been edited', () => {
        const lastParent = secondParentBatch[secondParentBatch.length - 1];

        const message = {
          displayName: 'edited',
          content: 'edited',
        };

        const editingActivity = Object.assign(
          {
            parent: {
              id: lastParent.id,
              type: 'edit',
            },
          },
          {
            object: message,
          }
        );

        return webex.internal.conversation
          .post(conversation, message, editingActivity)
          .then(() => getOlder())
          .then(({value}) => {
            const activities = value.map((act) => act.activity);
            const editedAct = find(activities, (act) => act.editParent);

            assert.equal(editedAct.editParent.id, lastParent.id);
            assert.notEqual(editedAct.id, lastParent.id);
          });
      });

      it('should return activities in thread order', () =>
        getOlder().then((data) => {
          const {value} = data;
          const oldestAct = value[0].activity;
          const newestAct = value[value.length - 1].activity;

          const oldestThreadIx = findIndex(value, ['activity.parent.type', 'reply']);
          const oldestParent = value[oldestThreadIx - 1].activity;

          assert.isTrue(oldestAct.published < newestAct.published);

          assert.doesNotHaveAnyKeys(oldestParent, 'parentActivityId');
          assert.isTrue(oldestParent.object.objectType === 'comment');
        }));

      it('should return next batch when getOlder is called a second time', () => {
        let firstBatch;

        return getOlder()
          .then(({value}) => {
            firstBatch = value;

            return getOlder();
          })
          .then(({value}) => {
            const secondBatch = value;

            const oldestRootInFirstBatch = find(firstBatch, [
              'activity.object.objectType',
              'comment',
            ]).activity;
            const newestRootInSecondBatch = findLast(secondBatch, [
              'activity.object.objectType',
              'comment',
            ]).activity;

            assert.isTrue(oldestRootInFirstBatch.published > newestRootInSecondBatch.published);
          });
      });

      it('should return done as true when no more activities can be fetched', () => {
        const {getOlder: getOlderWithLargeMin} =
          webex.internal.conversation.listActivitiesThreadOrdered({
            conversationId: conversation.id,
            minActivities: 50,
          });

        return getOlderWithLargeMin().then(({done}) => {
          assert.isTrue(done);
        });
      });

      describe('jumpToActivity()', () => {
        let _listActivitiesThreadOrderedSpy;

        beforeEach(() => {
          _listActivitiesThreadOrderedSpy = sinon.spy(
            webex.internal.conversation,
            '_listActivitiesThreadOrdered'
          );
        });

        afterEach(() => {
          webex.internal.conversation._listActivitiesThreadOrdered.restore();
        });

        it('should return searched-for activity with surrounding activities when jumpToActivity is called with an activity', () => {
          const search = firstParentBatch[firstParentBatch.length - 1];

          return jumpToActivity(search).then(({value}) => {
            const searchedForActivityIx = findIndex(value, ['id', search.id]);

            assert.isFalse(searchedForActivityIx === -1);
            assert.isTrue(searchedForActivityIx > 0);
            assert.isTrue(searchedForActivityIx < value.length);
          });
        });

        it('should return all activities in a space when jumping to an activity in a space with less activities than the asked-for activities limit', () =>
          webex.internal.conversation
            .create({participants: [scott.id]})
            .then((c) =>
              webex.internal.conversation
                .post(c, {displayName: 'first message'})
                .then((m) =>
                  webex.internal.conversation
                    .listActivities({conversationUrl: c.url})
                    .then((acts) => jumpToActivity(m).then(() => acts.length))
                )
            )
            .then((actCount) => {
              assert.isTrue(actCount < minActivities);
            }));

        it('should return all activities in a space when jumping to an activity in a space with more activities than the asked-for activities limit', () =>
          webex.internal.conversation
            .create({participants: [scott.id]})
            .then((c) => {
              const $posts = [];

              // eslint-disable-next-line no-plusplus
              for (let i = 0; i < 15; i++) {
                $posts.push(webex.internal.conversation.post(c, {displayName: `message ${i}`}));
              }

              return Promise.all($posts).then(() =>
                webex.internal.conversation.post(c, {displayName: 'message last'})
              );
            })
            .then((lastPost) => jumpToActivity(lastPost))
            .then(({value: acts}) => {
              assert.isAtLeast(acts.length, minActivities);

              const firstAct = acts[0].activity;

              assert.notEqual(firstAct.verb, 'create');
            }));

        it('should re-initialize _listActivitiesThreadOrdered when jumpToActivity is called with a new URL', () => {
          let conversation2, msg;

          return webex.internal.conversation
            .create({participants: [scott.id]})
            .then((c) => {
              conversation2 = c;

              return webex.internal.conversation.post(conversation2, {
                displayName: 'first message',
              });
            })
            .then((m) => {
              msg = m;

              return jumpToActivity(msg);
            })
            .then(() => {
              assert.isTrue(_listActivitiesThreadOrderedSpy.args[0][0].url === conversation2.url);
            });
        });
      });
    });
  });
});
