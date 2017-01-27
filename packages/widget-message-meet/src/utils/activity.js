import uuid from 'uuid';
import {isImage} from './files';

/**
 * Constructs a default activity
 *
 * @export
 * @param {any} conversation
 * @param {object} text
 * @param {string} text.content
 * @param {string} text.displayName
 * @param {any} actor
 * @returns {object}
 */
export function constructActivity(conversation, text, actor) {
  const clientTempId = `sdk-widget-message-meet-${uuid.v4()}`;
  return {
    actor: {
      displayName: actor.name,
      id: actor.id,
      objectType: `person`
    },
    // Needed for round trip
    clientTempId,
    id: clientTempId,
    // Minimum properties needed by API
    object: {
      displayName: text.displayName,
      content: text.content,
      objectType: `comment`
    },
    target: {
      id: conversation.id ? conversation.id : conversation,
      objectType: `conversation`
    },
    verb: `post`,
    published: new Date().toISOString(),
    clientPublished: new Date().toISOString(),
    _status: `pending`
  };
}


/**
 * Constructs a share activity
 *
 * @export
 * @param {any} conversation
 * @param {object} text
 * @param {string} text.content
 * @param {string} text.displayName
 * @param {object} actor
 * @param {array} files
 * @returns {object}
 */
export function constructActivityWithContent(conversation, text, actor, files) {
  const activity = constructActivity(conversation, text, actor);

  activity.object.objectType = `content`;
  activity.verb = `share`;
  const items = files.map((file) => {
    const item = Object.assign({}, file, {
      objectType: `file`,
      url: file.clientTempId
    });
    if (isImage(file)) {
      item.image = {
        url: file.thumbnail
      };
    }
    return item;
  });
  activity.object.files = {
    items
  };

  return activity;
}
