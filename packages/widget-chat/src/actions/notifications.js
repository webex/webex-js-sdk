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

export const DELETE_NOTIFICATION = `DELETE_NOTIFICATION`;
function deleteNotification(notificationId) {
  return {
    type: DELETE_NOTIFICATION,
    payload: {
      notificationId
    }
  };
}

export const UPDATE_NOTIFICATION_SETTING = `UPDATE_NOTIFICATION_SETTING`;
function updateNotificationSetting(setting) {
  return {
    type: UPDATE_NOTIFICATION_SETTING,
    payload: {
      setting
    }
  };
}

/**
 * Creates a new notification for processing
 *
 * @param {string} notificationId
 * @param {string} type
 * @returns {function}
 */
export function createNotification(notificationId, type) {
  return (dispatch) => dispatch(addNotification({notificationId, type}));
}

/**
 * Updates an existing notification to indicate that it was sent
 *
 * @param {string} notificationId
 * @returns {function}
 */
export function notificationSent(notificationId) {
  return (dispatch) => dispatch(deleteNotification(notificationId));
}

/**
 * Changes the permission type after we've request notification
 * permissions from the user
 *
 * @param {String} permission
 * @returns {function}
 */
export function setNotificationPermission(permission) {
  return (dispatch) => dispatch(updateNotificationSetting({permission}));
}

/**
 * Changes the setting for if native notifications are supported
 * by the user's device/browser
 *
 * @export
 * @param {bool} isSupported
 * @returns {function}
 */
export function setNotificationSupported(isSupported) {
  return (dispatch) => dispatch(updateNotificationSetting({isSupported}));
}
