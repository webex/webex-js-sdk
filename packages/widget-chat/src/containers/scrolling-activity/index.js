import React, {PropTypes} from 'react';
import classNames from 'classnames';
import injectScrollable from '../wrapper-scrollable';

import TypingIndicator from '../../components/typing-indicator';
import ActivityList from '../../components/activity-list';

import styles from './styles.css';

function ScrollingActivity(props) {
  const {
    activities,
    currentUserId,
    isTyping,
    onActivityDelete
  } = props;
  let typingIndicator;
  if (isTyping) {
    typingIndicator = <TypingIndicator />;
  }

  return (
    <div>
      <ActivityList
        activities={activities}
        currentUserId={currentUserId}
        onActivityDelete={onActivityDelete}
      />
      <div className={classNames(`indicators`, styles.indicators)}>
        {typingIndicator}
      </div>
    </div>
  );
}

ScrollingActivity.propTypes = {
  activities: PropTypes.array,
  currentUserId: PropTypes.string,
  isTyping: PropTypes.bool,
  onActivityDelete: PropTypes.func.isRequired
};

export default injectScrollable(ScrollingActivity);
