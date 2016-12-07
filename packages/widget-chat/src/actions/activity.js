import marked from 'marked';
import {filterSync} from '@ciscospark/helper-html';

import {isImage, sanitize} from '../utils/files';

export const ADD_FILES_TO_ACTIVITY = `ADD_FILES_TO_ACTIVITY`;
export function addFilesToActivity(files) {
  return {
    type: ADD_FILES_TO_ACTIVITY,
    payload: {
      files
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
 * @param {Map} activity - from store
 * @param {array} files
 * @param {object} spark - spark instance
 * @returns {function}
 */
export function addFiles(conversation, activity, files, spark) {
  return (dispatch) => {
    let shareActivity = activity.get(`shareActivity`);
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
* Removes file from ShareActiivty and from store
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
* @param {object} spark - spark instance from store
* @returns {function}
*/
export function submitActivity(conversation, activity, spark) {
  return (dispatch) => {
    dispatch(updateActivityStatus({isSending: true}));
    const message = _createMessageObject(activity.get(`text`));
    const shareActivity = activity.get(`shareActivity`);
    if (shareActivity && activity.get(`files`).size) {
      shareActivity.displayName = message.displayName;
      shareActivity.content = message.content;
      spark.conversation.share(conversation, shareActivity)
        .then(cleanupAfterSubmit(activity, dispatch));
    }
    else if (message) {
      spark.conversation.post(conversation, message)
        .then(cleanupAfterSubmit(activity, dispatch));
    }
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
  const files = activity.get(`files`);
  if (files.size) {
    files.forEach((file) => {
      revokeObjectURL(file);
    });
  }
  dispatch(resetActivity());
  dispatch(updateActivityStatus({isSending: false}));
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


function _createMessageObject(messageString) {
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
