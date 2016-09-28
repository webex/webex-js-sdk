/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

export default {
  conversation: {
    allowedInboundTags: {
      'spark-mention': [`data-object-type`, `data-object-id`, `data-object-url`]
    },
    allowedOutboundTags: {
      'spark-mention': [`data-object-type`, `data-object-id`, `data-object-url`]
    },
    // eslint-disable-next-line no-empty-function
    inboundProcessFunc: () => {},
    // eslint-disable-next-line no-empty-function
    outboundProcessFunc: () => {},
    allowedInboundStyles: [],
    allowedOutboundStyles: [],
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
