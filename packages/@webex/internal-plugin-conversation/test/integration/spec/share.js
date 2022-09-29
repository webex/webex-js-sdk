/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-conversation';

import {Defer} from '@webex/common';
import WebexCore from '@webex/webex-core';
import fh from '@webex/test-helper-file';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import testUsers from '@webex/test-helper-test-users';
import {find} from 'lodash';
import uuid from 'uuid';
import {flaky, skipInNode, browserOnly} from '@webex/test-helper-mocha';

/**
 * Resolves with the first argument passed in, after applying `fn()` on that
 * argument
 * @param {Function} fn
 * @returns {Promise<mixed>}
 */
function returnFirstArg(fn) {
  return (result) => Promise.resolve(fn(result))
    .then(() => result);
}

describe('plugin-conversation', function () {
  this.timeout(120000);
  describe('share', () => {
    let mccoy, participants, webex, spock;

    before(() => testUsers.create({count: 3})
      .then(async (users) => {
        participants = users;
        [spock, mccoy] = participants;

        // Pause for 5 seconds for CI
        await new Promise((done) => setTimeout(done, 5000));

        webex = new WebexCore({
          credentials: {
            authorization: spock.token
          }
        });

        mccoy.webex = new WebexCore({
          credentials: {
            authorization: mccoy.token
          }
        });

        return Promise.all([
          webex.internal.mercury.connect(),
          mccoy.webex.internal.mercury.connect()
        ]);
      }));

    after(() => Promise.all([
      webex && webex.internal.mercury.disconnect(),
      mccoy && mccoy.webex.internal.mercury.disconnect()
    ]));

    let conversation;

    beforeEach(() => {
      if (conversation) {
        return Promise.resolve();
      }

      return webex.internal.conversation.create({participants})
        .then((c) => { conversation = c; });
    });

    let hashTestText = '#test.txt';
    let sampleImageSmallOnePng = 'sample-image-small-one.png';
    let sampleImageSmallTwoPng = 'sample-image-small-two.png';
    let sampleImageLargeJpg = 'sample-image-large.jpg';
    let sampleImageLargeNoEXIFJpg = 'sample-image-large-no-exif.jpg';
    let samplePowerpointTwoPagePpt = 'sample-powerpoint-two-page.ppt';
    let sampleTextOne = 'sample-text-one.txt';
    let sampleTextTwo = 'sample-text-two.txt';
    const sampleGif = 'sample-gif.gif';

    before(() => Promise.all([
      fh.fetchWithoutMagic(hashTestText),
      fh.fetchWithoutMagic(sampleImageSmallOnePng),
      fh.fetchWithoutMagic(sampleImageSmallTwoPng),
      fh.fetchWithoutMagic(sampleImageLargeJpg),
      fh.fetchWithoutMagic(sampleImageLargeNoEXIFJpg),
      fh.fetchWithoutMagic(samplePowerpointTwoPagePpt),
      fh.fetchWithoutMagic(sampleTextOne),
      fh.fetchWithoutMagic(sampleTextTwo)
    ])
      .then((res) => {
        [
          hashTestText,
          sampleImageSmallOnePng,
          sampleImageSmallTwoPng,
          sampleImageLargeJpg,
          sampleImageLargeNoEXIFJpg,
          samplePowerpointTwoPagePpt,
          sampleTextOne,
          sampleTextTwo
        ] = res;
      }));

    describe('#share()', () => {
      it('shares the specified file to the specified conversation', () => webex.internal.conversation.share(conversation, [sampleTextOne])
        .then((activity) => {
          assert.isActivity(activity);
          assert.isEncryptedActivity(activity);
          assert.isFileItem(activity.object.files.items[0]);

          return webex.internal.conversation.download(activity.object.files.items[0]);
        })
        .then(returnFirstArg((f) => assert.match(f.type, /text\/plain/)))
        .then((f) => fh.isMatchingFile(f, sampleTextOne)
          .then((result) => assert.isTrue(result))));

      it('shares the specified set of files to the specified conversation', () => webex.internal.conversation.share(conversation, [sampleTextOne, sampleTextTwo])
        .then((activity) => {
          assert.isActivity(activity);
          assert.isEncryptedActivity(activity);
          assert.isFileItem(activity.object.files.items[0]);
          assert.isFileItem(activity.object.files.items[1]);

          return Promise.all([
            webex.internal.conversation.download(activity.object.files.items[0])
              .then(returnFirstArg((f) => assert.match(f.type, /text\/plain/))),
            webex.internal.conversation.download(activity.object.files.items[1])
              .then(returnFirstArg((f) => assert.match(f.type, /text\/plain/)))
          ]);
        })
        .then(([file0, file1]) => Promise.all([
          fh.isMatchingFile(file0, sampleTextOne)
            .then((result) => assert.isTrue(result)),
          fh.isMatchingFile(file1, sampleTextTwo)
            .then((result) => assert.isTrue(result))
        ])));

      describe('files with special characters', () => {
        it('shares the specified file to the specified conversation', () => webex.internal.conversation.share(conversation, [hashTestText])
          .then((activity) => {
            assert.isActivity(activity);
            assert.isEncryptedActivity(activity);
            assert.isFileItem(activity.object.files.items[0]);

            return webex.internal.conversation.download(activity.object.files.items[0]);
          })
          // in node, this'll be 'text/plain', in a browser, it'll be
          // 'text/html'. I'm pretty sure it's caused by the # convincing
          // express it's a hashroute and treating it as html. The discrepancy
          // has no bearing on the test's validity. Further, we need to use
          // match rather than equal because some browser append the charset.
          .then(returnFirstArg((f) => assert.match(f.type, hashTestText.type || /text\/plain/)))
          .then((f) => fh.isMatchingFile(f, hashTestText)
            .then((result) => assert.isTrue(result))));
      });

      it('shares an image with no EXIF data to the specified conversation and correctly error handles', () => webex.internal.conversation.share(conversation, [sampleImageLargeNoEXIFJpg])
        .then((activity) => {
          assert.isActivity(activity);
          assert.isEncryptedActivity(activity);

          const fileItem = activity.object.files.items[0];

          assert.isFileItem(fileItem);

          const thumbnailItem = activity.object.files.items[0].image;

          assert.isThumbnailItem(thumbnailItem);
          assert.equal(thumbnailItem.width, 640);
          assert.isAbove(thumbnailItem.height, 358);
          assert.isBelow(thumbnailItem.height, 361);

          return webex.internal.conversation.download(activity.object.files.items[0]);
        })
        .then(returnFirstArg((f) => assert.equal(f.type, 'image/jpeg')))
        .then((f) => fh.isMatchingFile(f, sampleImageLargeNoEXIFJpg)
          .then((result) => assert.isTrue(result))));

      it('shares the specified image to the specified conversation', () => webex.internal.conversation.share(conversation, [sampleImageLargeJpg])
        .then((activity) => {
          assert.isActivity(activity);
          assert.isEncryptedActivity(activity);

          const fileItem = activity.object.files.items[0];

          assert.isFileItem(fileItem);

          const thumbnailItem = activity.object.files.items[0].image;

          assert.isThumbnailItem(thumbnailItem);
          assert.equal(thumbnailItem.width, 640);
          assert.isAbove(thumbnailItem.height, 330);
          assert.isBelow(thumbnailItem.height, 361);

          return webex.internal.conversation.download(activity.object.files.items[0]);
        })
        .then(returnFirstArg((f) => assert.equal(f.type, 'image/jpeg')))
        .then((f) => fh.isMatchingFile(f, sampleImageLargeJpg)
          .then((result) => assert.isTrue(result))));

      it('shares the specified set of images the specified conversation', () => webex.internal.conversation.share(conversation, [sampleImageSmallOnePng, sampleImageSmallTwoPng])
        .then((activity) => {
          assert.isActivity(activity);
          assert.isEncryptedActivity(activity);
          assert.isFileItem(activity.object.files.items[0]);
          assert.isFileItem(activity.object.files.items[1]);
          assert.isThumbnailItem(activity.object.files.items[0].image);
          assert.isThumbnailItem(activity.object.files.items[1].image);

          return Promise.all([
            webex.internal.conversation.download(activity.object.files.items[0])
              .then(returnFirstArg((f) => assert.equal(f.type, 'image/png'))),
            webex.internal.conversation.download(activity.object.files.items[1])
              .then(returnFirstArg((f) => assert.equal(f.type, 'image/png')))
          ]);
        })
        .then(([file0, file1]) => Promise.all([
          fh.isMatchingFile(file0, sampleImageSmallOnePng)
            .then((result) => assert.isTrue(result)),
          fh.isMatchingFile(file1, sampleImageSmallTwoPng)
            .then((result) => assert.isTrue(result))
        ])));

      describe('when it shares a transcodable file', () => {
        let activities;
        let blockUntilTranscode;
        let clientTempId;
        let objectUrl;

        beforeEach(() => {
          clientTempId = uuid.v4();
          activities = [];
          webex.internal.mercury.on('event:conversation.activity', onMessage);
          blockUntilTranscode = new Defer();
        });

        afterEach(() => webex && webex.internal.mercury.off('event:conversation.activity', onMessage));

        function onMessage(message) {
          activities.push(message.data.activity);

          if (message.data.activity.clientTempId === clientTempId) {
            objectUrl = message.data.activity.object.url;
          }

          if (objectUrl) {
            const updateActivity = find(activities, (activity) => activity.verb === 'update' && activity.object.url === objectUrl);

            if (updateActivity) {
              blockUntilTranscode.resolve(updateActivity);
            }
          }
        }

        // doesn't seem like we get mercury event back to update transcoded file in time
        // https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-166178
        it.skip('mercury receives an update', () => webex.internal.conversation.share(conversation, {
          object: {
            files: [samplePowerpointTwoPagePpt]
          },
          clientTempId
        })
          .then((activity) => {
            assert.equal(activity.clientTempId, clientTempId);
            activities.push(activity);

            return webex.internal.conversation.download(activity.object.files.items[0])
              .then((f) => assert.equal(f.type, 'application/vnd.ms-powerpoint'))
              .then(() => blockUntilTranscode.promise)
              .then((updateActivity) => {
                assert.equal(updateActivity.object.url, activity.object.url);
                assert.lengthOf(updateActivity.object.files.items[0].transcodedCollection.items[0].files.items, 2);
                // Prove that the newly transcoded file can be downloaded and
                // decrypted
                const firstItem = updateActivity.object.files.items[0].transcodedCollection.items[0].files.items[0];

                return webex.internal.conversation.download(firstItem);
              });
          }));
      });

      it('shares a whiteboard', () => {
        const activity = webex.internal.conversation.makeShare(conversation);

        activity.add(sampleImageSmallOnePng, {
          actions: [{
            type: 'edit',
            mimeType: 'application/x-cisco-webex-whiteboard',
            url: 'https://boards.example.com/boards/1'
          }]
        });

        return webex.internal.conversation.share(conversation, activity)
          .then((share) => {
            assert.isActivity(share);
            assert.isEncryptedActivity(share);
            assert.isFileItem(share.object.files.items[0]);
            assert.isThumbnailItem(share.object.files.items[0].image);
            assert.equal(share.object.contentCategory, 'documents');
            assert.isArray(share.object.files.items[0].actions);
            assert.equal(share.object.files.items[0].actions[0].type, 'edit');
            assert.equal(share.object.files.items[0].actions[0].mimeType, 'application/x-cisco-webex-whiteboard');
            assert.equal(share.object.files.items[0].actions[0].url, 'https://boards.example.com/boards/1');

            return webex.internal.conversation.download(share.object.files.items[0])
              .then(returnFirstArg((f) => assert.equal(f.type, 'image/png')));
          })
          .then((file0) => fh.isMatchingFile(file0, sampleImageSmallOnePng)
            .then((result) => assert.isTrue(result)));
      });
    });

    describe('#makeShare', () => {
      // http-core doesn't current do upload progress events in node, so this
      // test is browser-only for now
      skipInNode(flaky(it, process.env.SKIP_FLAKY_TESTS))('provides an interface for file upload events', () => {
        const spy = sinon.spy();
        const share = webex.internal.conversation.makeShare(conversation);
        const emitter = share.add(sampleImageSmallOnePng);

        emitter.on('progress', spy);

        return webex.internal.conversation.share(conversation, share)
          .then(() => assert.called(spy));
      });

      it('shares a file with a name', () => {
        const share = webex.internal.conversation.makeShare(conversation);

        share.add(sampleImageSmallOnePng);
        share.object = {
          displayName: 'a name'
        };

        return webex.internal.conversation.share(conversation, share)
          .then((activity) => {
            assert.equal(activity.object.displayName, 'a name');

            return webex.internal.conversation.download(activity.object.files.items[0]);
          })
          .then(returnFirstArg((f) => assert.equal(f.type, 'image/png')))
          .then((file) => fh.isMatchingFile(file, sampleImageSmallOnePng));
      });

      it('allows removal of a file from the share', () => {
        const share = webex.internal.conversation.makeShare(conversation);

        share.add(sampleImageSmallOnePng);
        share.add(sampleImageSmallTwoPng);
        share.remove(sampleImageSmallOnePng);
        share.object = {
          displayName: 'a name'
        };

        return webex.internal.conversation.share(conversation, share)
          .then((activity) => {
            assert.equal(activity.object.displayName, 'a name');
            assert.lengthOf(activity.object.files.items, 1);

            return webex.internal.conversation.download(activity.object.files.items[0]);
          })
          .then(returnFirstArg((f) => assert.equal(f.type, 'image/png')))
          .then((file) => fh.isMatchingFile(file, sampleImageSmallTwoPng));
      });

      it('shares a file to a thread', () => {
        const share = webex.internal.conversation.makeShare(conversation);

        share.add(sampleImageSmallOnePng);
        share.object = {
          displayName: 'a name'
        };

        let parentActivityId;

        return webex.internal.conversation.share(conversation, share)
          .then((activity) => {
            assert.equal(activity.object.displayName, 'a name');
            const threadShare = webex.internal.conversation.makeShare(conversation);

            threadShare.add(sampleImageSmallOnePng);
            threadShare.object = {
              displayName: 'a thread share name'
            };
            threadShare.activityType = 'reply';
            threadShare.parentActivityId = activity.id;
            parentActivityId = activity.id;

            return webex.internal.conversation.share(conversation, threadShare);
          })
          .then((activity) => {
            const {id, type} = activity.parent;

            assert.equal(id, parentActivityId);
            assert.equal(type, 'reply');

            return webex.internal.conversation.download(activity.object.files.items[0]);
          })
          .then(returnFirstArg((f) => assert.equal(f.type, 'image/png')))
          .then((file) => fh.isMatchingFile(file, sampleImageSmallOnePng));
      });
    });

    describe('#addGif', () => {
      let blob, buffer;

      // Read file as buffer
      browserOnly(before)(() => fh.fetch(sampleGif)
        .then((file) => {
          blob = file;

          return new Promise((resolve) => {
            /* global FileReader */
            const fileReader = new FileReader();

            fileReader.onload = function () {
              buffer = this.result;
              resolve();
            };
            fileReader.readAsArrayBuffer(blob);
          });
        }));

      browserOnly(it)('if the giphy does not exist, then we check it gets added to this.uploads', (done) => {
        // eslint-disable-next-line no-undef
        const file = new File([buffer], blob.name, {type: 'image/gif'});

        const originalGiphyURL = 'https://media1.giphy.com/media/nXxOjZrbnbRxS/giphy.gif';
        const originalGiphyStillURL = 'https://media1.giphy.com/media/nXxOjZrbnbRxS/giphy_s.gif';
        const url = 'https://giphy.com';

        // simulate in web client where
        Object.defineProperty(file, 'url', {value: originalGiphyURL});
        // define thumbnail
        Object.defineProperty(file, 'image', {
          value: {
            height: file.width,
            width: file.height,
            url: originalGiphyStillURL
          }
        });

        const share = webex.internal.conversation.makeShare(conversation);

        // Check that initially there were no uploads
        assert.isTrue(share.uploads.size === 0);
        share.addGif(file).then(() => {
          assert.equal(share.uploads.size, 1);
          assert.equal(share.uploads.get(file).objectType, 'file');
          assert.equal(share.uploads.get(file).displayName, sampleGif);
          assert.equal(share.uploads.get(file).mimeType, 'image/gif');
          assert.equal(share.uploads.get(file).fileSize, 473119);
          assert.equal(share.uploads.get(file).width, 200);
          assert.equal(share.uploads.get(file).height, 270);
          assert.equal(share.uploads.get(file).url, url);
          assert.exists(share.uploads.get(file).scr);
          assert.equal(share.uploads.get(file).scr.loc, originalGiphyURL);

          assert.exists(share.uploads.get(file).image);
          assert.equal(share.uploads.get(file).image.width, 200);
          assert.equal(share.uploads.get(file).image.height, 270);
          assert.equal(share.uploads.get(file).image.url, url);
          assert.exists(share.uploads.get(file).image.scr);
          assert.equal(share.uploads.get(file).image.scr.loc, originalGiphyStillURL);
        });
        done();
      });
    });
  });
});
