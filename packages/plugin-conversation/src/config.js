/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

export default {
  conversation: {
    allowedTags: {
      'spark-mention': [`data-object-type`, `data-object-id`, `data-object-url`]
    },
    allowedStyles: [],
    /**
     * Max height for thumbnails generated when sharing an image
     * @type {number}
     */
    thumbnailMaxHeight: 960,
    /**
     * Max width for thumbnails generated when sharing an image
     * @type {number}
     */
    thumbnailMaxWidth: 640,
    /**
     * Primarily for testing. When true, decrypting an activity will create a
     * sister property with the original encrypted string
     * @type {Boolean}
     */
    keepEncryptedProperties: false
  }
};
