import React, {PropTypes} from 'react';
import classNames from 'classnames';
import injectScrollable from '../wrapper-scrollable';

import TypingIndicator from '../../components/typing-indicator';
import ActivityList from '../../components/activity-list';
import Spinner from '../../components/spinner';

import styles from './styles.css';

function ScrollingActivity(props) {
  const {
    activities,
    currentUserId,
    isLoadingHistoryDown,
    isLoadingHistoryUp,
    isTyping,
    onActivityDelete
  } = props;
  let spinnerDown, spinnerUp, typingIndicator;
  if (isTyping) {
    typingIndicator = <TypingIndicator />;
  }

  const spinner = <div className={classNames(`spinner-container`, styles.spinnerContainer)}><Spinner /></div>;

  if (isLoadingHistoryUp) {
    spinnerUp = spinner;
  }
  else if (isLoadingHistoryDown) {
    spinnerDown = spinner;
  }

  return (
    <div>
      {spinnerUp}
      <ActivityList
        activities={activities}
        currentUserId={currentUserId}
        onActivityDelete={onActivityDelete}
      />
      {spinnerDown}
      <div className={classNames(`indicators`, styles.indicators)}>
        {typingIndicator}
      </div>
    </div>
  );
}

ScrollingActivity.propTypes = {
  activities: PropTypes.array,
  currentUserId: PropTypes.string,
  isLoadingHistoryDown: PropTypes.bool,
  isLoadingHistoryUp: PropTypes.bool,
  isTyping: PropTypes.bool,
  onActivityDelete: PropTypes.func.isRequired
};

export default injectScrollable(ScrollingActivity);
