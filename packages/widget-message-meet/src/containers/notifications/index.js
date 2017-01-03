import {Component} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import _ from 'lodash';

import browserUtilities from '../../utils/browser';
import getUnsentNotifications from '../../selectors/notifications';
import {notificationSent, setNotificationPermission, setNotificationSupported} from '../../actions/notifications';

const TIMEOUT_LENGTH = 10000;

export class Notifications extends Component {
  shouldComponentUpdate(nextProps) {
    const {props} = this;
    return nextProps.notifications !== props.notifications || nextProps.isSupported !== props.isSupported || nextProps.permission !== props.permission;
  }

  componentDidUpdate() {
    const {props} = this;
    // Default state is not supported, once we know it is, don't check any more
    if (!props.isSupported) {
      this.checkSupported();
    }
    if (_.isNull(props.permission) && props.isSupported) {
      this.requestPermission();
    }
    this.displayNotifications();
  }

  /**
   * Requests permission from the browser to allow notifications
   *
   * @returns {Promise}
   */
  requestPermission() {
    const {props} = this;
    // eslint-disable-next-line import/no-named-as-default-member
    return browserUtilities.requestPermissionForNotifications((permission) => props.setNotificationPermission(permission));
  }

  /**
   * Checks if browser notifications are supported and updates store
   *
   * @returns {null}
   */
  checkSupported() {
    const {props} = this;
    // eslint-disable-next-line import/no-named-as-default-member
    if (!props.isSupported && browserUtilities.isNotificationSupported()) {
      props.setNotificationSupported(true);
    }
  }

  /**
   * Processes notifications and displays them if needed
   *
   * @returns {null}
   */
  displayNotifications() {
    const {props} = this;
    // eslint-disable-next-line import/no-named-as-default-member
    const hasPermission = props.permission === browserUtilities.PERMISSION_GRANTED;
    if (props.notifications.length > 0) {
      props.notifications.forEach((notification) => {
        const {username, message, avatar, notificationId} = notification;
        // eslint-disable-next-line import/no-named-as-default-member
        if (hasPermission && browserUtilities.isBrowserHidden()) {
          // Actually display notification
          // eslint-disable-next-line import/no-named-as-default-member
          browserUtilities.spawnNotification(message, avatar, username, TIMEOUT_LENGTH);
        }
        props.notificationSent(notificationId);
      });
    }
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
