// eslint-disable-reason combining lots of items from store
/* eslint-disable max-params */
import {createSelector} from 'reselect';
import _ from 'lodash';
import moment from 'moment';

import {ACTIVITY_ITEM_TYPE_ACTIVITY_ITEM, ACTIVITY_ITEM_TYPE_DAY_SEPARATOR, ACTIVITY_ITEM_TYPE_NEW_MESSAGE_SEPARATOR} from '../components/activity-list';

const getActivities = (state) => state.conversation.activities.toArray(); // eslint-disable-line func-style
const getAvatars = (state) => state.user.avatars;
const getCurrentUserId = (state) => state.user.currentUser.id;
const getFlags = (state) => state.flags.flags; // eslint-disable-line func-style
const getLastAcknowledgedActivityId = (state) => state.conversation.lastAcknowledgedActivityId;
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
 * This loops through our conversation activities and computes an array
 * of 'visible activities' to be used with the ActivityList component
 */
export const getActivityList = createSelector(
  [getActivities, getAvatars, getCurrentUserId, getFlags, getLastAcknowledgedActivityId],
  (activities, avatars, currentUserId, flags, lastAcknowledgedActivityId) => {
    const visibleActivityList = [];
    const now = moment();
    let lastActorId, lastDay, lastVerb;
    let shouldDisplayNewMessageMarker = false;

    activities.forEach((activity) => {
      // Insert day separator if this activity and last one happen on a different day
      const activityMoment = moment(activity.published, moment.ISO_8601);
      const activityDay = activityMoment.endOf(`day`);
      const sameDay = activityDay.diff(lastDay, `days`) === 0;
      if (lastDay && !sameDay) {
        visibleActivityList.push(
          {
            type: ACTIVITY_ITEM_TYPE_DAY_SEPARATOR,
            fromDate: lastDay,
            key: `day-separtor-${activity.id}`,
            now,
            toDate: activityDay
          }
        );
      }
      lastDay = activityDay;

      // New message marker
      if (shouldDisplayNewMessageMarker) {
        visibleActivityList.push({
          type: ACTIVITY_ITEM_TYPE_NEW_MESSAGE_SEPARATOR,
          key: `new-messages-${activity.id}`
        });
        shouldDisplayNewMessageMarker = false;
      }

      // Actual visible activity item
      // additional items don't repeat user avatar and name
      const isAdditional = sameDay && lastActorId === activity.actor.id && lastVerb === activity.verb;
      lastActorId = activity.actor.id;
      lastVerb = activity.verb;
      // eslint-disable-reason callbacks are necessary
      // eslint-disable-next-line max-nested-callbacks
      const isFlagged = flags && flags.some((flag) => flag.activityUrl === activity.url);
      visibleActivityList.push(
        {
          type: ACTIVITY_ITEM_TYPE_ACTIVITY_ITEM,
          activity,
          avatarUrl: avatars[activity.actor.id],
          isAdditional,
          isFlagged,
          isSelf: currentUserId === activity.actor.id
        }
      );

      // Check if this is the last read activity
      const isLastAcked = lastAcknowledgedActivityId && lastAcknowledgedActivityId === activity.id;
      const isNotSelf = currentUserId !== activity.actor.id;
      if (isLastAcked && isNotSelf) {
        shouldDisplayNewMessageMarker = true;
      }
    });
    return visibleActivityList;
  }
);
