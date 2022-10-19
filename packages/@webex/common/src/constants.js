export const SDK_EVENT = {
  INTERNAL: {
    WEBEX_ACTIVITY: 'event:conversation.activity',
    ACTIVITY_FIELD: {
      ACTOR: 'actor',
      OBJECT: 'object',
      TARGET: 'target'
    },
    ACTIVITY_VERB: {
      ACKNOWLEDGE: 'acknowledge',
      CARD_ACTION: 'cardAction',
      CREATE: 'create',
      POST: 'post',
      SHARE: 'share',
      DELETE: 'delete',
      ADD: 'add',
      LEAVE: 'leave',
      ADD_MODERATOR: 'assignModerator',
      REMOVE_MODERATOR: 'unassignModerator',
      LOCK: 'lock',
      UNLOCK: 'unlock',
      HIDE: 'hide',
      UPDATE: 'update'
    },
    ACTIVITY_TAG: {
      HIDDEN: 'HIDDEN',
      ONE_ON_ONE: 'ONE_ON_ONE',
      LOCKED: 'LOCKED'
    }
  },
  EXTERNAL: {
    EVENT_TYPE: {
      CREATED: 'created',
      DELETED: 'deleted',
      UPDATED: 'updated',
      SEEN: 'seen'
    },
    OWNER: {
      CREATOR: 'creator',
      ORG: 'org'
    },
    STATUS: {
      ACTIVE: 'active',
      DISABLED: 'disabled'
    },
    SPACE_TYPE: {
      DIRECT: 'direct',
      GROUP: 'group'
    },
    RESOURCE: {
      ATTACHMENT_ACTIONS: 'attachmentActions',
      MEMBERSHIPS: 'memberships',
      MESSAGES: 'messages',
      ROOMS: 'rooms'
    },
    ATTACHMENTS: {
      CARD_CONTENT_TYPE: 'application/vnd.microsoft.card.adaptive'
    }
  }
};

export const hydraTypes = {
  ATTACHMENT_ACTION: 'ATTACHMENT_ACTION',
  CONTENT: 'CONTENT',
  MEMBERSHIP: 'MEMBERSHIP',
  MESSAGE: 'MESSAGE',
  ORGANIZATION: 'ORGANIZATION',
  PEOPLE: 'PEOPLE',
  ROOM: 'ROOM',
  TEAM: 'TEAM'
};

export const deviceType = {
  PROVISIONAL: 'PROVISIONAL',
  WEB: 'WEB'
};

export const INTERNAL_US_CLUSTER_NAME = 'urn:TEAM:us-east-2_a';
export const INTERNAL_US_INTEGRATION_CLUSTER_NAME = 'urn:TEAM:us-east-1_int13';
