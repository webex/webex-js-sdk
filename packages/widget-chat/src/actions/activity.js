import marked from 'marked';
import {filterSync} from '@ciscospark/helper-html';

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

export function submitActivity(conversation, activity, spark) {
  return (dispatch) => {
    dispatch(updateActivityStatus({isSending: true}));
    const message = _createMessageObject(activity.getIn([`object`, `displayName`]));
    if (!activity.getIn(`files`)) {
      spark.conversation.post(conversation, message)
        .then(() => dispatch(createActivity(conversation, ``, conversation.participants[0])))
        .then(() => dispatch(updateActivityStatus({isSending: false})));
    }
  };
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
