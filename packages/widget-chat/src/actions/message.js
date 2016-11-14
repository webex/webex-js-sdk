import marked from 'marked';
import {filterSync} from '@ciscospark/helper-html';

export const UPDATE_MESSAGE_STATE = `UPDATE_MESSAGE_STATE`;
export function updateMessageState(state) {
  return {
    type: UPDATE_MESSAGE_STATE,
    payload: {
      state
    }
  };
}

export const UPDATE_MESSAGE_CONTENT = `UPDATE_MESSAGE_CONTENT`;
export function updateMessageContent(value) {
  return {
    type: UPDATE_MESSAGE_CONTENT,
    payload: {
      value
    }
  };
}

export function setMessage(value) {
  return (dispatch) => {
    dispatch(updateMessageContent(value));
  };
}

export function submitMessage(conversation, message, spark) {
  return (dispatch) => {
    dispatch(updateMessageState({isSending: true}));
    spark.conversation.post(conversation, _createMessageObject(message))
      .then(() => dispatch(updateMessageContent(``)))
      .then(() => dispatch(updateMessageState({isSending: false})));
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
