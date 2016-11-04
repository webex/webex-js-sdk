import {createSelector} from 'reselect';
import _ from 'lodash';

const getActivities = (state) => state.conversation.activities; // eslint-disable-line func-style
const getParticipants = (state) => state.conversation.participants; // eslint-disable-line func-style

export const getMostRecentActivity = createSelector(
  getActivities,
  (activities) => _.last(activities)
);

export const getMostRecentReadReceipts = createSelector(
  [getActivities, getParticipants],
  (activities, participants) => {
    const activity = _.last(activities);
    return participants.filter((participant) =>
      participant.roomProperties.lastSeenActivityUUID === activity.id
    );
  }
);
