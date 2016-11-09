/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
import fh from '@ciscospark/test-helper-file';
import {find, map} from 'lodash';
import uuid from 'uuid';

function generateTonsOfContents(numOfContents) {
  return new Promise((resolve) => {
    const contents = [];

    for (let i = 0; i < numOfContents; i++) {
      contents.push({
        type: `curve`,
        payload: JSON.stringify({id: i, type: `curve`})
      });
    }
    resolve(contents);
  });
}

describe(`plugin-board`, () => {
  describe(`service`, () => {
    let board, conversation, fixture, participants;

    before(`create users`, () => testUsers.create({count: 3})
      .then((users) => {
        participants = users;

        return Promise.all(map(participants, (participant) => {
          participant.spark = new CiscoSpark({
            credentials: {
              authorization: participant.token
            }
          });
          return participant.spark.device.register();
        }));
      }));

    before(`create conversation`, () => participants[0].spark.conversation.create({
      displayName: `Test Board Conversation`,
      participants
    })
      .then((c) => {
        conversation = c;
        return conversation;
      }));

    before(`create channel (board)`, () => participants[0].spark.board.createChannel(conversation)
      .then((channel) => {
        board = channel;
        return channel;
      }));

    before(`load fixture image`, () => fh.fetch(`sample-image-small-one.png`)
      .then((fetchedFixture) => {
        fixture = fetchedFixture;
        return fetchedFixture;
      }));

    after(`disconnect mercury`, () => Promise.all(map(participants, (participant) => {
      return participant.spark.mercury.disconnect();
    })));

    describe(`#getChannel`, () => {
      it(`gets the channal metadata`, () => {
        return participants[0].spark.board.getChannel(board)
          .then((channel) => {
            assert.property(channel, `kmsResourceUrl`);
            assert.property(channel, `aclUrl`);

            assert.equal(channel.channelUrl, board.channelUrl);
            assert.equal(channel.aclUrlLink, conversation.aclUrl);
            assert.notEqual(channel.kmsResourceUrl, conversation.kmsResourceObjectUrl);
            assert.notEqual(channel.aclUrl, conversation.aclUrl);
            assert.notEqual(channel.defaultEncryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);
          });
      });
    });

    describe(`#_uploadImage()`, () => {

      after(() => participants[0].spark.board.deleteAllContent(board));

      it(`uploads image to spark files`, () => {
        return participants[0].spark.board._uploadImage(conversation, fixture)
          .then((scr) => {
            return participants[0].spark.encryption.download(scr);
          })
          .then((downloadedFile) => {
            assert(fh.isMatchingFile(downloadedFile, fixture));
          });
      });
    });

    describe(`#setSnapshotImage()`, () => {

      after(() => participants[0].spark.board.deleteAllContent(board));

      it(`uploads image to spark files and adds to channel`, () => {
        let imageRes;
        return participants[0].spark.board.setSnapshotImage(conversation, board, fixture)
          .then((res) => {
            imageRes = res.image;
            assert.isDefined(res.image, `image field is included`);
            assert.equal(res.image.encryptionKeyUrl, conversation.encryptionKeyUrl);
            assert.isAbove(res.image.scr.length, 0, `scr string exists`);
            return participants[1].spark.board.getChannel(board);
          })
          .then((res) => {
            assert.deepEqual(imageRes, res.image);
          });
      });
    });

    describe(`#ping()`, () => {

      it(`pings board service`, () => participants[0].spark.board.ping()
        .then((res) => {
          assert.property(res, `serviceName`);
          assert.equal(res.serviceName, `Board`);
        }));
    });

    describe(`#addImage()`, () => {
      let testContent, testScr;

      after(() => participants[0].spark.board.deleteAllContent(board));

      it(`uploads image to spark files`, () => {
        return participants[0].spark.board.addImage(conversation, board, fixture)
          .then((fileContent) => {
            testContent = fileContent[0].items[0];
            assert.equal(testContent.type, `FILE`, `content type should be image`);
            assert.property(testContent, `contentUrl`, `content should contain contentId property`);
            assert.property(testContent, `channelUrl`, `content should contain contentUrl property`);
            assert.property(testContent, `scr`, `content should contain scr property`);
          });
      });

      it(`adds to presistence`, () => {
        return participants[0].spark.board.getContents(board)
          .then((allContents) => {
            const imageContent = find(allContents.items, {contentId: testContent.contentId});
            assert.isDefined(imageContent);
            assert.property(imageContent, `scr`);
            assert.equal(imageContent.displayName, `sample-image-small-one.png`);
            testScr = imageContent.scr;
            return imageContent.scr;
          });
      });

      it(`matches file file downloaded`, () => {
        return participants[0].spark.encryption.download(testScr)
          .then((downloadedFile) => {
            assert(fh.isMatchingFile(downloadedFile, fixture));
          });
      });
    });

    describe(`#getChannels`, () => {

      it(`retrieves a newly created board for a specified conversation within a single page`, () => {
        return participants[0].spark.board.getChannels(conversation)
          .then((getChannelsResp) => {
            const channelFound = find(getChannelsResp.items, {channelId: board.channelId});
            assert.isDefined(channelFound);
            assert.notProperty(getChannelsResp.links, `next`);
          });
      });

      it(`retrieves all boards for a specified conversation across multiple pages`, () => {
        let existingChannelsCount = 0;
        let numChannelsToAdd = 0;
        const pageLimit = 50;

        return participants[0].spark.board.getChannels(conversation, {
          channelsLimit: 100
        })
          .then((res) => {
            existingChannelsCount = res.length;
            assert(existingChannelsCount < pageLimit, `the existing channel count must be less that pageLimit for this test`);
            numChannelsToAdd = pageLimit - existingChannelsCount + 1;
          })

          .then(() => {
            const promises = [];

            for (let i = 0; i < numChannelsToAdd; i++) {
              promises.push(participants[0].spark.board.createChannel(conversation));
            }
            return Promise.all(promises);
          })

          // get boards, page 1
          .then(() => {
            return participants[0].spark.board.getChannels(conversation, {
              channelsLimit: pageLimit
            });
          })

          // get boards, page 2
          .then((channelPage) => {
            assert.lengthOf(channelPage.items, pageLimit);
            assert(channelPage.hasNext());
            return channelPage.next();
          })
          .then((channelPage) => {
            assert.lengthOf(channelPage, 1);
            assert(!channelPage.hasNext());
          });
      });
    });

    describe(`#getContents()`, () => {

      afterEach(() => participants[0].spark.board.deleteAllContent(board));

      it(`adds and gets contents from the specified board`, () => {
        const contents = [{type: `curve`}];
        const data = [{
          type: contents[0].type,
          payload: JSON.stringify(contents[0])
        }];

        return participants[0].spark.board.deleteAllContent(board)
          .then(() => participants[0].spark.board.addContent(board, data))
          .then(() => participants[0].spark.board.getContents(board))
          .then((contentPage) => {
            assert.equal(contentPage.length, data.length);
            assert.equal(contentPage.items[0].payload, data[0].payload);
            assert.equal(contentPage.items[0].type, data[0].type);
          })
          .then(() => participants[0].spark.board.deleteAllContent(board));
      });

      it(`allows other people to read contents`, () => {
        const contents = [{type: `curve`, points: [1, 2, 3, 4]}];
        const data = [{
          type: contents[0].type,
          payload: JSON.stringify(contents[0])
        }];

        return participants[0].spark.board.addContent(board, data)
          .then(() => {
            return participants[1].spark.board.getContents(board);
          })
          .then((contentPage) => {
            assert.equal(contentPage.length, data.length);
            assert.equal(contentPage.items[0].payload, data[0].payload);
            return participants[2].spark.board.getContents(board);
          })
          .then((contentPage) => {
            assert.equal(contentPage.length, data.length);
            assert.equal(contentPage.items[0].payload, data[0].payload);
          });
      });

      it(`allows other people to write contents`, () => {
        const contents = [{type: `curve`, points: [1, 2, 3, 4]}];
        const data = [{
          type: contents[0].type,
          payload: JSON.stringify(contents[0])
        }];

        return participants[2].spark.board.addContent(board, data)
          .then(() => {
            return participants[1].spark.board.getContents(board);
          })
          .then((contentPage) => {
            assert.equal(contentPage.length, data.length);
            assert.equal(contentPage.items[0].payload, data[0].payload);
          });
      });

      describe(`handles large data sets`, () => {
        const numberOfContents = 30;
        let tonsOfContents;

        before(`generate contents`, () => {
          return generateTonsOfContents(numberOfContents)
            .then((res) => {
              tonsOfContents = res;
            });
        });

        beforeEach(`create contents`, () => participants[0].spark.board.addContent(board, tonsOfContents));

        it(`using the default page limit`, () => participants[0].spark.board.getContents(board)
          .then((res) => {
            assert.lengthOf(res, numberOfContents);
            assert(!res.hasNext());

            for (let i = 0; i < res.length; i++) {
              assert.equal(res.items[i].payload, tonsOfContents[i].payload, `payload data matches`);
            }
          }));

        it(`using a client defined page limit`, () => participants[0].spark.board.getContents(board, {contentsLimit: 25})
          .then((res) => {
            assert.lengthOf(res, 25);
            assert(res.hasNext());
            return res.next();
          })
          .then((res) => {
            assert.lengthOf(res, numberOfContents - 25);
            assert(!res.hasNext());
          }));
      });
    });

    describe(`#deleteContent()`, () => {

      after(() => participants[0].spark.board.deleteAllContent(board));

      it(`delete contents from the specified board`, () => {
        const channel = board;
        const contents = [
          {
            id: uuid.v4(),
            type: `file`
          },
          {
            id: uuid.v4(),
            type: `string`
          }
        ];
        const data = [
          {
            type: contents[0].type,
            payload: JSON.stringify(contents[0])
          },
          {
            type: contents[1].type,
            payload: JSON.stringify(contents[1])
          }
        ];

        return participants[0].spark.board.addContent(channel, data)
          .then(() => participants[0].spark.board.deleteAllContent(channel))
          .then(() => participants[0].spark.board.getContents(channel))
          .then((res) => {
            assert.lengthOf(res, 0);
            return res;
          })
          .then(() => participants[0].spark.board.addContent(channel, data))
          .then((res) => {
            assert.lengthOf(res[0].items, 2);
            const content = res[0].items[0];
            return participants[0].spark.board.deleteContent(channel, content);
          })
          .then(() => participants[0].spark.board.getContents(channel))
          .then((res) => {
            assert.lengthOf(res, 1);
            assert.equal(res.items[0].payload, data[1].payload);
            return res;
          });
      });
    });
  });
});
