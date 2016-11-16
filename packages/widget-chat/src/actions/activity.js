import marked from 'marked';
import {filterSync} from '@ciscospark/helper-html';

import {
  constructImage,
  isImage,
  sanitize
} from '../utils/files';

import {
  storeShares,
  uploadFiles
} from './share';


export const ADD_FILES_TO_ACTIVITY = `ADD_FILES_TO_ACTIVITY`;
export function addFilesToActivity(files) {
  return {
    type: ADD_FILES_TO_ACTIVITY,
    payload: {
      files
    }
  };
}

export const CREATE_ACTIVITY = `CREATE_ACTIVITY`;
export function createActivity(conversation, text, actor) {
  return {
    type: CREATE_ACTIVITY,
    payload: {
      actor,
      conversation,
      text
    }
  };
}

export const UPDATE_ACTIVITY_STATE = `UPDATE_ACTIVITY_STATE`;
export function updateActivityState(state) {
  return {
    type: UPDATE_ACTIVITY_STATE,
    payload: {
      state
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

export function addShareFiles(conversation, activity, files, spark) {
  return (dispatch) => {
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
        dispatch(updateActivityState({isUploadingShare: true}));
        dispatch(addFilesToActivity(cleanFiles));
        dispatch(storeShares(localImages));
        dispatch(uploadFiles(conversation, activity, files, spark));
      });
  };
}


export function submitActivity(conversation, activity, spark) {
  return (dispatch) => {
    dispatch(updateActivityState({isSending: true}));
    const message = _createMessageObject(activity.object.displayName);
    if (activity.files) {
      dispatch(updateActivityState({isSending: false}));
    }
    else {
      spark.conversation.post(conversation, message)
        .then(() => dispatch(resetActivity(conversation)))
        .then(() => dispatch(updateActivityState({isSending: false})));
    }
  };
}

export function resetActivity(conversation) {
  return (dispatch) => dispatch(createActivity(conversation, ``, conversation.participants[0]));
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
