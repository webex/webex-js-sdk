import {createSelector} from 'reselect';

const getActivities = (state) => state.conversation.activities; // eslint-disable-line func-style
const getNotifications = (state) => state.notifications.items; // eslint-disable-line func-style
const getAvatars = (state) => state.user.avatars; // eslint-disable-line func-style

export const getUnsentNotifications = createSelector(
  [getActivities, getNotifications, getAvatars],
  (activities, notifications, avatars) =>
    notifications
      .filter((notification) => !notification.sent)
      .map((notification) => {
        const notificationActivity = findActivityWithUrl(activities, notification.notificationId);
        return Object.assign({}, notification, {
          username: notificationActivity.actor.displayName,
          message: notificationActivity.object.displayName,
          avatar: avatars[notificationActivity.actor.id]
        });
      })
);

function findActivityWithUrl(activities, url) {
  return activities.find((activity) => activity.url === url);
}
