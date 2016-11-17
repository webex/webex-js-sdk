import {ADD_NOTIFICATION, MARK_NOTIFICATION_SENT, UPDATE_NOTIFICATION_SETTING} from '../actions/notifications';

export default function reduceNotifications(state = {
  items: [],
  settings: {
    isSupported: false,
    permission: null
  }
}, action) {
  switch (action.type) {
  case ADD_NOTIFICATION:
    {
      const {notificationId, type} = action.payload.notification;
      if (state.items.find((notification) => notification.notificationId === notificationId)) {
        // Don't add notifications for items already added
        return state;
      }
      const notification = {
        notificationId,
        type,
        sent: false
      };
      return Object.assign({}, state, {items: [notification, ...state.items]});
    }
  case MARK_NOTIFICATION_SENT:
    return Object.assign({}, state, {
      items: state.items.map((notification) => {
        if (notification.notificationId === action.payload.notificationId) {
          notification.sent = true;
        }
        return notification;
      })
    });
  case UPDATE_NOTIFICATION_SETTING:
    return Object.assign({}, state, {settings: Object.assign({}, state.settings, action.payload.setting)});
  default:
    return state;
  }
}
