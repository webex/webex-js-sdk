/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import CiscoSpark from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import testUsers from '@ciscospark/test-helper-test-users';
import fh from '@ciscospark/test-helper-file';
import makeLocalUrl from '@ciscospark/test-helper-make-local-url';

describe(`Plugin : Conversation`, function() {
  this.timeout(20000);
  describe(`#download()`, () => {
    let checkov, mccoy, participants, spark, spock;

    let sampleImageSmallOnePng = `sample-image-small-one.png`;

    before(() => testUsers.create({count: 3})
      .then((users) => {
        participants = [spock, mccoy, checkov] = users;

        spark = new CiscoSpark({
          credentials: {
            authorization: spock.token
          }
        });

        return spark.mercury.connect();
      }));

    after(() => spark.mercury.disconnect());

    let conversation;
    before(() => spark.conversation.create({participants})
      .then((c) => {conversation = c;}));

    before(() => fh.fetch(sampleImageSmallOnePng)
      .then((res) => {sampleImageSmallOnePng = res;}));

    it(`downloads and decrypts an encrypted file`, () => spark.conversation.share(conversation, {files: [sampleImageSmallOnePng]})
      .then((activity) => spark.conversation.download(activity.object.files.items[0]))
      .then((f) => assert.eventually.isTrue(fh.isMatchingFile(f, sampleImageSmallOnePng))));

    it(`emits download progress events for encrypted files`, () => spark.conversation.share(conversation, {files: [sampleImageSmallOnePng]})
      .then((activity) => {
        const spy = sinon.spy();
        return spark.conversation.download(activity.object.files.items[0])
          .on(`progress`, spy)
          .then(() => assert.called(spy));
      }));

    it(`downloads and decrypts a non-encrypted file`, () => spark.conversation.download({url: makeLocalUrl(`/sample-image-small-one.png`)})
      .then((f) => assert.eventually.isTrue(fh.isMatchingFile(f, sampleImageSmallOnePng))));

    it(`emits download progress events for non-encrypted files`, () => {
      const spy = sinon.spy();
      return spark.conversation.download({url: makeLocalUrl(`/sample-image-small-one.png`)})
        .on(`progress`, spy)
        .then((f) => assert.eventually.isTrue(fh.isMatchingFile(f, sampleImageSmallOnePng)))
        .then(() => assert.called(spy));
    });
  });

});
