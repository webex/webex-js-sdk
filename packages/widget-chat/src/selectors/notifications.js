import {createSelector} from 'reselect';

const getActivities = (state) => state.conversation.activities; // eslint-disable-line func-style
const getNotifications = (state) => state.notifications.items; // eslint-disable-line func-style

export const getUnsentNotifications = createSelector(
  [getActivities, getNotifications],
  (activities, notifications) =>
    notifications.filter((notification) => !notification.sent)
);
