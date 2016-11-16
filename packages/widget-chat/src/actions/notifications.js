export const NOTIFICATION_TYPE_POST = `NOTIFICATION_TYPE_POST`;

export const ADD_NOTIFICATION = `ADD_NOTIFICATION`;
function addNotification(notification) {
  return {
    type: ADD_NOTIFICATION,
    payload: {
      notification
    }
  };
}

export const MARK_NOTIFICATION_SENT = `MARK_NOTIFICATION_SENT`;
function markNotificationSent(notificationId) {
  return {
    type: MARK_NOTIFICATION_SENT,
    payload: {
      notificationId
    }
  };
}

export function createNotification(activityId, type) {
  return (dispatch) => dispatch(addNotification({activityId, type}));
}

export function notificationSent(notificationId) {
  return (dispatch) => dispatch(markNotificationSent(notificationId));
}
