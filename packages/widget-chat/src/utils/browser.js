export const PERMISSION_GRANTED = `granted`;
export const PERMISSION_DENIED = `denied`;

const browserUtilities = {
  PERMISSION_GRANTED,
  PERMISSION_DENIED,
  isBrowserHidden,
  isNotificationSupported,
  requestPermissionForNotifications,
  spawnNotification
};


/**
 * Returns true if the main browser window is hidden, minimized,
 * or in the background; false otherwise.
 *
 * @returns {boolean} hidden
 */
export function isBrowserHidden() {
  return document.webkitHidden || document.mozHidden || document.msHidden || document.hidden || !document.hasFocus();
}

/**
 * Checks if native browser notifications are supported
 *
 * @export
 * @returns {bool}
 */
export function isNotificationSupported() {
  return window && window.Notification;
}

export function requestPermissionForNotifications(callback) {
  return window.Notification.requestPermission(callback);
}

/**
 * Displays a browser notification and automatically closes after timeout
 *
 * @param {String} theBody body of the notification
 * @param {String} theIcon the url of the icon to display
 * @param {String} theTitle
 * @param {Integer} timeoutLength non-zero amount of time to display the notification
 *
 * @returns {Object} Browser notification object
 *
 */
export function spawnNotification(theBody, theIcon, theTitle, timeoutLength) {
  const options = {
    body: theBody,
    icon: theIcon
  };
  const browserNotification = new Notification(theTitle, options);
  if (timeoutLength) {
    setTimeout(() => {
      browserNotification.close();
    }, timeoutLength);
  }

  return browserNotification;
}

export default browserUtilities;
