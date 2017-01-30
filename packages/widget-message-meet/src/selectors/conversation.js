// eslint-disable-reason combining lots of items from store
/* eslint-disable max-params */
import {createSelector} from 'reselect';
import _ from 'lodash';
import moment from 'moment';

import {ITEM_TYPE_ACTIVITY, ITEM_TYPE_DAY_SEPARATOR, ITEM_TYPE_NEW_MESSAGE_SEPARATOR} from '../components/activity-list';

const getActivities = (state) => state.conversation.activities.toArray();
const getAvatars = (state) => state.user.avatars;
const getCurrentUser = (state) => state.user.currentUser;
const getFlags = (state) => state.flags.flags;
const getInFlightActivities = (state) => state.activity.get(`inFlightActivities`).toArray();
const getLastAcknowledgedActivityId = (state) => state.conversation.lastAcknowledgedActivityId;
const getParticipants = (state) => state.conversation.participants;

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
  [getActivities, getAvatars, getCurrentUser, getInFlightActivities, getFlags, getLastAcknowledgedActivityId],
  (activities, avatars, currentUser, inFlightActivities, flags, lastAcknowledgedActivityId) => {
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
            type: ITEM_TYPE_DAY_SEPARATOR,
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
          type: ITEM_TYPE_NEW_MESSAGE_SEPARATOR,
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
          type: ITEM_TYPE_ACTIVITY,
          activity,
          avatarUrl: avatars[activity.actor.id],
          isAdditional,
          isFlagged,
          isSelf: currentUser.id === activity.actor.id
        }
      );

      // Check if this is the last read activity
      const isLastAcked = lastAcknowledgedActivityId && lastAcknowledgedActivityId === activity.id;
      const isNotSelf = currentUser.id !== activity.actor.id;
      if (isLastAcked && isNotSelf) {
        shouldDisplayNewMessageMarker = true;
      }
    });

    // Create a "fake" activity to display in flight activities
    inFlightActivities.forEach((inFlightActivity) => {
      visibleActivityList.push(
        {
          type: ITEM_TYPE_ACTIVITY,
          activity: inFlightActivity,
          avatarUrl: avatars[currentUser.id],
          isAdditional: false,
          isFlagged: false,
          isSelf: true,
          isPending: true
        }
      );
    });

    return visibleActivityList;
  }
);
