/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var fh2 = require('../lib/fixtures-v2');
var generateRandomString = require('../../../src/util/generate-random-string');
var pick = require('lodash.pick');
var pluck = require('lodash.pluck');

module.exports = {
  extractParticipants: function(users) {
    return pluck(users, 'email');
  },

  generateComment: function() {
    return generateRandomString(50);
  },

  generateSubject: function() {
    return generateRandomString(10);
  },

  assertIsValidThumbnailItem: function assertIsValidThumbnailItem(thumbnail) {
    assert.isDefined(thumbnail);
    assert.property(thumbnail, 'scr', 'The thumbnail has an scr');
    assert.property(thumbnail.scr, 'loc', 'The thumbnail\'s scr has an loc');
    assert.property(thumbnail, 'height', 'The thumbnail has a width');
    assert.property(thumbnail, 'width', 'The thumbnail has a width');
  },

  assertIsValidFileItem: function assertIsValidFileItem(file) {
    assert.property(file, 'displayName', 'The file has a display name');
    assert.property(file, 'scr', 'The file has an scr');
    assert.property(file.scr, 'loc', 'The file\'s scr has an loc');
  },

  assertIsSameFile: function assertIsSameFile(file, expected) {
    assert.equal(file.type, expected.type, 'The downloaded file\'s type matched the source file\'s type');
    return assert.eventually.isTrue(fh2.isMatchingFile(file, expected), 'The downloaded file is byte-for-byte the same as the source file');
  },

  assertIsExpectedThumbnail: function assertIsExpectedThumbnail(file, thumbnailFileItem) {
    // NOTE: This is commented out because thumbnails appear not to have a mimeType
    // Therefore we can't to check if the file downloaded has a matching type.
    // assert.equal(file.type, thumbnailFileItem.mimeType);

    return assert.becomes(fh2.determineImageDimensions(file), pick(thumbnailFileItem, 'height', 'width'));
  }

};
