import {CONTENT, WHITEBOARD} from '../constants';

const MediaSharesUtils: any = {};

/**
 * parses the relevant values for mediaShares: contentId, disposition
 * @param {Object} mediaShares
 * @returns {undefined}
 */
MediaSharesUtils.parse = (mediaShares: object) => {
  if (mediaShares) {
    return {
      content: {
        beneficiaryId: MediaSharesUtils.getContentBeneficiaryId(mediaShares),
        disposition: MediaSharesUtils.getContentDisposition(mediaShares),
      },
      whiteboard: {
        beneficiaryId: MediaSharesUtils.getWhiteboardBeneficiaryId(mediaShares),
        disposition: MediaSharesUtils.getWhiteboardDisposition(mediaShares),
        resourceUrl: MediaSharesUtils.getWhiteboardResourceUrl(mediaShares),
      },
    };
  }

  return null;
};

/**
 * get the previous and current mediaShares values parsed, as well as the boolean updates
 * @param {Object} oldShare
 * @param {Object} newShare
 * @returns {Object}
 * previous: {Object} old share, current: {Object} new share,
 */
MediaSharesUtils.getMediaShares = (oldShare: object, newShare: object) => {
  const previous = oldShare && MediaSharesUtils.parse(oldShare);
  const current = newShare && MediaSharesUtils.parse(newShare);

  return {
    previous,
    current,
  };
};

/**
 * get the content floor disposition (released, granted)
 * @param {Object} mediaShares
 * @returns {Boolean} disposition
 */
MediaSharesUtils.getContentDisposition = (mediaShares: object) => {
  const contentFloor = MediaSharesUtils.extractContentFloor(mediaShares);

  return contentFloor ? contentFloor.disposition : null;
};

/**
 * get the whiteboard floor disposition (released, granted)
 * @param {Object} mediaShares
 * @returns {Boolean} disposition
 */
MediaSharesUtils.getWhiteboardDisposition = (mediaShares: object) => {
  const whiteboardFloor = MediaSharesUtils.extractWhiteboardFloor(mediaShares);

  return whiteboardFloor ? whiteboardFloor.disposition : null;
};

/**
 * extract the content property from media shares
 * @param {Object} mediaShares
 * @returns {Object}
 */
MediaSharesUtils.extractContent = (mediaShares: any) => {
  if (!mediaShares || !mediaShares.length) {
    return null;
  }

  return mediaShares.find((share) => share.name === CONTENT) || null;
};

/**
 * extract the whiteboard property from media shares
 * @param {Object} mediaShares
 * @returns {Object}
 */
MediaSharesUtils.extractWhiteboard = (mediaShares: any) => {
  if (!mediaShares || !mediaShares.length) {
    return null;
  }

  return mediaShares.find((share) => share.name === WHITEBOARD) || null;
};

/**
 * extract the media stream floor property from content object
 * @param {Object} mediaStream
 * @returns {Object}
 */
MediaSharesUtils.extractFloor = (mediaStream: any) => {
  if (!mediaStream) {
    return null;
  }

  return mediaStream.floor;
};

/**
 * extract the content's floor from media shares
 * @param {Object} mediaShares
 * @returns {Object}
 */
MediaSharesUtils.extractContentFloor = (mediaShares: object) => {
  const content = MediaSharesUtils.extractContent(mediaShares);

  return MediaSharesUtils.extractFloor(content);
};

/**
 * extract the whiteboard's floor from media shares
 * @param {Object} mediaShares
 * @returns {Object}
 */
MediaSharesUtils.extractWhiteboardFloor = (mediaShares: object) => {
  const whiteboard = MediaSharesUtils.extractWhiteboard(mediaShares);

  return MediaSharesUtils.extractFloor(whiteboard);
};

/**
 * get who is sharing from media shares (content)
 * @param {Object} mediaShares
 * @returns {Object}
 */
MediaSharesUtils.getContentBeneficiaryId = (mediaShares: object) => {
  const contentFloor = MediaSharesUtils.extractContentFloor(mediaShares);

  if (!contentFloor || !contentFloor.beneficiary) {
    return null;
  }

  return contentFloor.beneficiary.id;
};

/**
 * get who is sharing from media shares (whiteboard)
 * @param {Object} mediaShares
 * @returns {Object}
 */
MediaSharesUtils.getWhiteboardBeneficiaryId = (mediaShares: object) => {
  const whiteboardFloor = MediaSharesUtils.extractWhiteboardFloor(mediaShares);

  if (!whiteboardFloor || !whiteboardFloor.beneficiary) {
    return null;
  }

  return whiteboardFloor.beneficiary.id;
};

/**
 * get the which whiteboard is being shared via resource url
 * @param {Object} mediaShares
 * @returns {Object}
 */
MediaSharesUtils.getWhiteboardResourceUrl = (mediaShares: object) => {
  const whiteboard = MediaSharesUtils.extractWhiteboard(mediaShares);

  if (!whiteboard || !whiteboard.resourceUrl) {
    return null;
  }

  return whiteboard.resourceUrl;
};

export default MediaSharesUtils;
