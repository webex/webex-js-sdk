import configureStore from 'redux-mock-store';
import {OrderedMap} from 'immutable';

import {initialState as conversation} from '../../reducers/conversation';
import {initialState as flags} from '../../reducers/flags';
import {initialState as indicators} from '../../reducers/indicators';
import {initialState as user} from '../../reducers/user';

const activities = [{
  id: `3f977de0-d1d9-11e6-869c-1154edc7a0cf`,
  objectType: `activity`,
  url: `https://conv-a.wbx2.com/conversation/api/v1/activities/3f977de0-d1d9-11e6-869c-1154edc7a0cf`,
  published: `2017-01-03T17:22:48.638Z`,
  verb: `post`,
  actor: {
    id: `12abd-dc77-4747-af67-2e38ba0fb762`,
    objectType: `person`,
    displayName: `Ricky Testerson`,
    orgId: `consumer`,
    emailAddress: `Ricky.Testerson@gmail.com`,
    entryUUID: `12abd-dc77-4747-af67-2e38ba0fb762`,
    type: `PERSON`,
    entryEmail: `Ricky.Testerson@gmail.com`
  },
  object: {
    objectType: `comment`,
    displayName: `hi`
  },
  target: {
    id: `ba0ae11-7199-3dee-86b1-9bbef68320f0`,
    objectType: `conversation`,
    url: `https://conv-a.wbx2.com/conversation/api/v1/conversations/ba0ae11-7199-3dee-86b1-9bbef68320f0`,
    participants: {
      items: []
    },
    activities: {
      items: []
    },
    tags: [],
    defaultActivityEncryptionKeyUrl: `https://encryption-a.wbx2.com/encryption/api/v1/keys/11f13e-a95e-41c5-b1b1-daaa926f3432`,
    kmsResourceObjectUrl: `https://encryption-a.wbx2.com/encryption/api/v1/resources/829717c4-9a99-41cc-aff9-7660efc39fb4`
  },
  clientTempId: `ac3c3e5c-4f63-41aa-94bd-2a1951aac747`,
  encryptionKeyUrl: `https://encryption-a.wbx2.com/encryption/api/v1/keys/11f13e-a95e-41c5-b1b1-daaa926f3432`
}, {
  id: `8f013af0-d455-11e6-9f2d-5f2147b91ac0`,
  objectType: `activity`,
  url: `https://conv-a.wbx2.com/conversation/api/v1/activities/8f013af0-d455-11e6-9f2d-5f2147b91ac0`,
  published: `2017-01-06T21:17:41.791Z`,
  verb: `post`,
  actor: {
    id: `5sa32-dc77-4747-af67-2e38ba0fb762`,
    objectType: `person`,
    displayName: `Jon Langley`,
    orgId: `consumer`,
    emailAddress: `Jon.Langley@gmail.com`,
    entryUUID: `5sa32-dc77-4747-af67-2e38ba0fb762`,
    type: `PERSON`,
    entryEmail: `Jon.Langley@gmail.com`
  },
  object: {
    objectType: `comment`,
    displayName: `123`
  },
  target: {
    id: `ba0ae11-7199-3dee-86b1-9bbef68320f0`,
    objectType: `conversation`,
    url: `https://conv-a.wbx2.com/conversation/api/v1/conversations/ba0ae11-7199-3dee-86b1-9bbef68320f0`,
    participants: {
      items: []
    },
    activities: {
      items: []
    },
    tags: [],
    defaultActivityEncryptionKeyUrl: `https://encryption-a.wbx2.com/encryption/api/v1/keys/11f13e-a95e-41c5-b1b1-daaa926f3432`,
    kmsResourceObjectUrl: `https://encryption-a.wbx2.com/encryption/api/v1/resources/829717c4-9a99-41cc-aff9-7660efc39fb4`
  },
  clientTempId: `abc-123-346`,
  encryptionKeyUrl: `https://encryption-a.wbx2.com/encryption/api/v1/keys/11f13e-a95e-41c5-b1b1-daaa926f3432`
}];

const mockedCurrentUser = {
  id: `12abd-dc77-4747-af67-2e38ba0fb762`,
  objectType: `person`,
  displayName: `Ricky Testerson`,
  orgId: `consumer`,
  emailAddress: `Ricky.Testerson@gmail.com`,
  entryUUID: `12abd-dc77-4747-af67-2e38ba0fb762`,
  type: `PERSON`,
  entryEmail: `Ricky.Testerson@gmail.com`
};

const middlewares = [];
const mockStore = configureStore(middlewares);

const mockedActivities = new OrderedMap(activities.map((activity) => [activity.url, activity]));
const mockedConversation = Object.assign({}, conversation, {
  activities: conversation.activities.merge(mockedActivities)
});

const store = mockStore({
  conversation: mockedConversation,
  flags: Object.assign({}, flags, {
    flags: [
      {activityUrl: `https://conv-a.wbx2.com/conversation/api/v1/activities/8f013af0-d455-11e6-9f2d-5f2147b91ac0`}
    ]
  }),
  indicators,
  user: Object.assign({}, user, {
    currentUser: mockedCurrentUser
  })
});

export default store;
