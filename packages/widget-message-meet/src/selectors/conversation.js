import {createSelector} from 'reselect';
import _ from 'lodash';

const getActivities = (state) => state.conversation.activities.toArray(); // eslint-disable-line func-style
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
      participant.roomProperties && participant.roomProperties.lastSeenActivityUUID === activity.id
    );
  }
);

/**
 * This creates an array to be used with the ActivityList component
 */
export const getActivityList = createSelector(
  [getActivities],
  (activities) => activities // Testing
);
