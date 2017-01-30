import {ADD_NOTIFICATION, DELETE_NOTIFICATION, UPDATE_NOTIFICATION_SETTING} from '../actions/notifications';

export const initialState = {
  items: [],
  settings: {
    isSupported: false,
    permission: null
  }
};

export default function reduceNotifications(state = initialState, action) {
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
        type
      };
      return Object.assign({}, state, {items: [notification, ...state.items]});
    }
  case DELETE_NOTIFICATION:
    return Object.assign({}, state, {
      items: state.items.filter((notification) => notification.notificationId !== action.payload.notificationId)
    });
  case UPDATE_NOTIFICATION_SETTING:
    return Object.assign({}, state, {settings: Object.assign({}, state.settings, action.payload.setting)});
  default:
    return state;
  }
}
