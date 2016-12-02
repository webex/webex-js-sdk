import uuid from 'uuid';

export function constructActivity(conversation, text, actor) {
  return {
    actor: {
      displayName: actor.name,
      id: actor.id,
      objectType: `person`
    },
    // Needed for round trip
    clientTempId: `sdk-widget-chat-${uuid.v4()}`,
    // Minimum properties needed by API
    object: {
      displayName: text.displayName || text,
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
