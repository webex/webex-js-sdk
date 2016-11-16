import {ADD_NOTIFICATION, MARK_NOTIFICATION_SENT} from '../actions/notifications';

export default function indicators(state = {
  items: []
}, action) {
  switch (action.type) {
  case ADD_NOTIFICATION:
    {
      const {activityId, type} = action.payload.notification;
      const notification = {
        activityId,
        type,
        sent: false
      };
      return {items: [notification, ...state.items]};
    }
  case MARK_NOTIFICATION_SENT:
    return {
      items: state.items.map((notification) => {
        if (notification.activityId === action.payload.activityId) {
          notification.sent = true;
        }
        return notification;
      })
    };
  default:
    return state;
  }
}
