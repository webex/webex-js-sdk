import marked from 'marked';
import {filterSync} from '@ciscospark/helper-html';

import {isImage, sanitize} from '../utils/files';
import {constructActivity, constructActivityWithContent} from '../utils/activity';

export const ADD_FILES_TO_ACTIVITY = `ADD_FILES_TO_ACTIVITY`;
export function addFilesToActivity(files) {
  return {
    type: ADD_FILES_TO_ACTIVITY,
    payload: {
      files
    }
  };
}

export const ADD_INFLIGHT_ACTIVITY = `ADD_INFLIGHT_ACTIVITY`;
function addInflightActivity(activity) {
  return {
    type: ADD_INFLIGHT_ACTIVITY,
    payload: {
      activity
    }
  };
}

export const REMOVE_FILE_FROM_ACTIVITY = `REMOVE_FILE_FROM_ACTIVITY`;
export function removeFileFromActivity(id) {
  return {
    type: REMOVE_FILE_FROM_ACTIVITY,
    payload: {
      id
    }
  };
}

export const REMOVE_INFLIGHT_ACTIVITY = `REMOVE_INFLIGHT_ACTIVITY`;
export function removeInflightActivity(id) {
  return {
    type: REMOVE_INFLIGHT_ACTIVITY,
    payload: {
      id
    }
  };
}

export const RESET_ACTIVITY = `RESET_ACTIVITY`;
export function resetActivity() {
  return {
    type: RESET_ACTIVITY
  };
}

export const SAVE_SHARE_ACTIVITY = `SAVE_SHARE_ACTIVITY`;
export function saveShareActivity(shareActivity) {
  return {
    type: SAVE_SHARE_ACTIVITY,
    payload: {
      shareActivity
    }
  };
}

export const SUBMIT_ACTIVITY_START = `SUBMIT_ACTIVITY_START`;
export function submitActivityStart() {
  return {
    type: SUBMIT_ACTIVITY_START
  };
}

export const UPDATE_ACTIVITY_STATUS = `UPDATE_ACTIVITY_STATUS`;
export function updateActivityStatus(status) {
  return {
    type: UPDATE_ACTIVITY_STATUS,
    payload: {
      status
    }
  };
}

export const UPDATE_ACTIVITY_TEXT = `UPDATE_ACTIVITY_TEXT`;
export function updateActivityText(text) {
  return {
    type: UPDATE_ACTIVITY_TEXT,
    payload: {
      text
    }
  };
}


/**
 * Adds file to message, creates Share activity if not present, starts upload
 *
 * @param {object} conversation - from store
 * @param {Map} activityStore - from store
 * @param {array} files
 * @param {object} spark - spark instance
 * @returns {function}
 */
export function addFiles(conversation, activityStore, files, spark) {
  return (dispatch) => {
    let shareActivity = activityStore.getIn([`shareActivity`]);
    if (!shareActivity) {
      shareActivity = spark.conversation.makeShare(conversation);
      // Store shareActivity object to be used later
      dispatch(saveShareActivity(shareActivity));
    }

    let cleanFiles;
    if (files && files.length) {
      cleanFiles = files.map((file) => {
        const clean = sanitize(file);
        // Create thumbnail objectURL
        if (isImage(clean)) {
          clean.thumbnail = createObjectURL(clean);
        }
        return clean;
      });
    }
    dispatch(updateActivityStatus({isUploadingShare: true}));
    dispatch(addFilesToActivity(cleanFiles));
    cleanFiles.forEach((file) => shareActivity.add(file));

  };
}

/**
* Removes file from ShareActivty and from store
*
* @param {string} id - clientTempId key of stored file
* @param {Map} activity - from store
* @returns {function}
*/
export function removeFile(id, activity) {
  return (dispatch) => {
    const shareActivity = activity.get(`shareActivity`);
    const file = activity.getIn([`files`, id]);
    shareActivity.remove(file).then(() => {
      revokeObjectURL(file);
      return dispatch(removeFileFromActivity(id));
    });
  };
}

/**
* Constructs and sends activity to server
*
* @param {object} conversation - from store
* @param {Map} activity - from store
* @param {object} user - from store
* @param {object} spark - spark instance from store
* @returns {function}
*/
export function submitActivity(conversation, activity, user, spark) {
  return (dispatch) => {
    const message = createMessageObject(activity.get(`text`));
    const shareActivity = activity.get(`shareActivity`);
    if (shareActivity && activity.get(`files`).size) {
      const inFlightActivity = constructActivityWithContent(conversation, message, user, activity.get(`files`).toArray());
      dispatch(createInFlightActivity(inFlightActivity));
      // map our temp id to the in flight temp id so we can remove it when it is received
      shareActivity.displayName = message.displayName;
      shareActivity.content = message.content;
      shareActivity.clientTempId = inFlightActivity.clientTempId;
      spark.conversation.share(conversation, shareActivity);
      cleanupAfterSubmit(activity, dispatch);
    }
    else if (message) {
      const inFlightActivity = constructActivity(conversation, message, user);
      dispatch(createInFlightActivity(inFlightActivity));
      dispatch(resetActivity());
      spark.conversation.post(conversation, message, {clientTempId: inFlightActivity.clientTempId});
    }
  };
}

/**
 * Sets the typing status of the current user
 *
 * @param {boolean} isTyping
 * @param {object} conversation
 * @param {object} spark
 * @returns {function}
 */
export function setUserTyping(isTyping, conversation, spark) {
  return (dispatch) => {
    spark.conversation.updateTypingStatus(conversation, {typing: isTyping});
    return dispatch(updateActivityStatus({isTyping}));
  };
}


/**
* Helper to reset Activity store
*
* @param {Map} activity
* @param {function} dispatch
* @returns {function}
*/
function cleanupAfterSubmit(activity, dispatch) {
  const files = activity.getIn([`files`]);
  if (files.size) {
    files.forEach((file) => {
      revokeObjectURL(file);
    });
  }
  dispatch(resetActivity());
}

/**
 * Create objectURL
 *
 * @param {object} file
 * @returns {string}
 */
function createObjectURL(file) {
  const urlCreator = window.URL || window.webkitURL;
  return urlCreator.createObjectURL(file);
}

/**
 * Revoke objectURL
 *
 * @param {object} file
 * @returns {undefined}
 */
function revokeObjectURL(file) {
  const urlCreator = window.URL || window.webkitURL;
  urlCreator.revokeObjectURL(file);
}


/**
 * Creates markdown and stripped text object
 *
 * @param {string} messageString
 * @returns {object}
 */
function createMessageObject(messageString) {
  let content;
  let markedString = marked(messageString) || ``;
  let displayName = messageString || ``;

  // The marked library wraps some things in <p> tags that we need to remove
  // Replace a string '<p>sample text<\p>   ' with 'sample text'
  markedString = markedString.replace(/\<p\>/, ``);
  markedString = markedString.replace(/\<\/p\>\s*$/, ``);

  // markedString = HtmlUtil.escapeOutboundString(markedString);

  const INCLUDES_HTML_TAG = /<.+>/;
  // if doesn't include '<*>' after escapeOutboundString, keep the content value undefined
  if (INCLUDES_HTML_TAG.test(markedString)) {
    content = markedString;
    // Strip all html tags for raw text
    // eslint-disable-next-line no-empty-function
    displayName = filterSync(() => {}, [], [], markedString);
  }

  const messageObject = {
    content,
    displayName
  };

  return messageObject;
}

/**
 * Creates an in flight activity
 *
 * @export
 * @param {object} activity
 * @returns {function}
 */
export function createInFlightActivity(activity) {
  return (dispatch) => dispatch(addInflightActivity(activity));
}
