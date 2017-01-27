import {connect} from 'react-redux';
import ActivityList from '../../components/activity-list';
import {getActivityList} from '../../selectors/conversation';

function mapStateToProps(state, props) {
  return Object.assign({}, props, {
    activities: getActivityList(state)
  });
}

const ConnectedActivityList = connect(
  mapStateToProps
)(ActivityList);

export default ConnectedActivityList;
