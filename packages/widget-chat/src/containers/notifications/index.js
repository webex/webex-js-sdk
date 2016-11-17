import {Component} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import _ from 'lodash';

import {getUnsentNotifications} from '../../selectors/notifications';
import {notificationSent, setNotificationPermission, setNotificationSupported} from '../../actions/notifications';

const TIMEOUT_LENGTH = 10000;

class Notifications extends Component {
  shouldComponentUpdate(nextProps) {
    const {props} = this;
    return nextProps.notifications !== props.notifications || nextProps.isSupported !== props.isSupported || nextProps.permission !== props.permission;
  }

  componentDidUpdate() {
    const {props} = this;
    // Default state is not supported, once we know it is, don't check any more
    if (!props.isSupported) {
      this._checkSupported();
    }
    if (_.isNull(props.permission) && props.isSupported) {
      Notification.requestPermission((permission) => props.setNotificationPermission(permission));
    }
    this._displayNotifications();
  }

  /**
   * Checks if browser notifications are supported and updates store
   *
   * @returns {null}
   */
  _checkSupported() {
    const {props} = this;
    if (!props.isSupported && window && window.Notification) {
      props.setNotificationSupported(true);
    }
  }

  /**
   * Checks if we have permission from the user to send a notification
   *
   * @returns {bool}
   *
   * @memberOf Notifications
   */
  _hasPermission() {
    const {props} = this;
    return props.permission === `granted`;
  }

  /**
   * Returns true if the main browser window is hidden, minimized,
   * or in the background; false otherwise.
   *
   * @returns {boolean} hidden
   */
  _isBrowserHidden() {
    return document.webkitHidden || document.mozHidden || document.msHidden || document.hidden || !document.hasFocus();
  }

  /**
   * Processes notifications and displays them if needed
   *
   * @returns {null}
   */
  _displayNotifications() {
    const {props} = this;
    if (props.notifications.length > 0) {
      props.notifications.forEach((notification) => {
        const {username, message, avatar, notificationId} = notification;
        if (this._hasPermission() && this._isBrowserHidden()) {
          // Actually display notification
          this._spawnNotification(message, avatar, username);
        }
        props.notificationSent(notificationId);
      });
    }
  }

  /**
   * Displays a browser notification and automatically closes after timeout
   *
   * @param {String} theBody body of the notification
   * @param {String} theIcon the url of the icon to display
   * @param {String} theTitle
   *
   * @returns {Object} Browser notification object
   *
   */
  _spawnNotification(theBody, theIcon, theTitle) {
    const options = {
      body: theBody,
      icon: theIcon
    };
    const browserNotification = new Notification(theTitle, options);
    setTimeout(() => {
      browserNotification.close();
    }, TIMEOUT_LENGTH);

    return browserNotification;
  }

  render() {
    return null;
  }
}

function mapStateToProps(state) {
  return {
    isSupported: state.notifications.settings.isSupported,
    notifications: getUnsentNotifications(state),
    permission: state.notifications.settings.permission
  };
}

export default connect(
  mapStateToProps,
  (dispatch) => bindActionCreators({
    notificationSent,
    setNotificationPermission,
    setNotificationSupported
  }, dispatch)
)(Notifications);
