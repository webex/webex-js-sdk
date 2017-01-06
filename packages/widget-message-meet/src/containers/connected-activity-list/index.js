import {connect} from 'react-redux';
import ActivityList from '../../components/activity-list';
import {getActivityList} from '../../selectors/conversation';

function mapStateToProps(state, props) {
  return Object.assign({}, props, {
    activities: getActivityList(state),
    avatars: state.user.avatars,
    currentUserId: state.user.currentUser.id,
    flags: state.flags.flags,
    lastAcknowledgedActivityId: state.conversation.lastAcknowledgedActivityId
  });
}

const ConnectedActivityList = connect(
  mapStateToProps
)(ActivityList);

export default ConnectedActivityList;
