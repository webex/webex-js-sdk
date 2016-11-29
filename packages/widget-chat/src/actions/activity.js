import marked from 'marked';
import {filterSync} from '@ciscospark/helper-html';

import {
  constructImage,
  isImage,
  sanitize
} from '../utils/files';

import {
  constructActivity
} from '../utils/activity';


export const ADD_FILES_TO_ACTIVITY = `ADD_FILES_TO_ACTIVITY`;
export function addFilesToActivity(files) {
  return {
    type: ADD_FILES_TO_ACTIVITY,
    payload: {
      files
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


export function addFiles(conversation, activity, files, spark) {
  return (dispatch) => {
    let shareActivity = activity.get(`shareActivity`);
    if (!shareActivity) {
      shareActivity = spark.conversation.makeShare(conversation);
      // Store shareActivity object to be used later
      dispatch(saveShareActivity(shareActivity));
    }

    const images = [];
    let cleanFiles;
    if (files && files.length) {
      cleanFiles = files.map((file) => {
        file = sanitize(file);
        if (isImage(file)) {
          images.push(constructImage(file));
        }
        return file;
      });
    }

    Promise.all(images)
      .then((localImages) => {
        dispatch(updateActivityStatus({isUploadingShare: true}));
        dispatch(addFilesToActivity(cleanFiles));
        cleanFiles.forEach((file) => shareActivity.add(file));
        // create update staging area with new files
      });
  };
}

export function submitActivity(conversation, activity, spark) {
  return (dispatch) => {
    dispatch(updateActivityStatus({isSending: true}));
    const message = _createMessageObject(activity.get(`text`));
    const shareActivity = activity.get(`shareActivity`);
    if (shareActivity) {
      shareActivity.displayName = message.displayName;
      shareActivity.content = message.content;
      spark.conversation.share(conversation, shareActivity)
        .then(cleanupAfterSubmit(dispatch));
    }
    else if (message) {
      spark.conversation.post(conversation, message)
        .then(cleanupAfterSubmit(dispatch));
    }
  };
}

function cleanupAfterSubmit(dispatch) {
  dispatch(resetActivity());
  dispatch(updateActivityStatus({isSending: false}));
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
