import React, {PropTypes} from 'react';
import classNames from 'classnames';
import injectScrollable from '../wrapper-scrollable';

import ActivityList from '../../components/activity-list';
import Spinner from '../../components/spinner';
import ReadReceipts from '../read-receipts';

import styles from './styles.css';

function ScrollingActivity(props) {
  const {
    isLoadingHistoryUp
  } = props;
  let spinnerUp;

  const spinner = <div className={classNames(`spinner-container`, styles.spinnerContainer)}><Spinner /></div>;

  if (isLoadingHistoryUp) {
    spinnerUp = spinner;
  }

  return (
    <div>
      {spinnerUp}
      <ActivityList {...props} />
      <div className={classNames(`indicators`, styles.indicators)}>
        <ReadReceipts />
      </div>
    </div>
  );
}

ScrollingActivity.propTypes = {
  activities: PropTypes.array,
  avatars: PropTypes.object.isRequired,
  currentUserId: PropTypes.string,
  flags: PropTypes.array,
  isLoadingHistoryUp: PropTypes.bool,
  onActivityDelete: PropTypes.func.isRequired,
  onActivityFlag: PropTypes.func.isRequired
};

export default injectScrollable(ScrollingActivity);
