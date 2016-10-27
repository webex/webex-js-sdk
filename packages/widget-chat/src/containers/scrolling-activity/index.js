import React, {PropTypes} from 'react';
import classNames from 'classnames';
import injectScrollable from '../wrapper-scrollable';

import TypingIndicator from '../../components/typing-indicator';
import ActivityList from '../../components/activity-list';

import styles from './styles.css';

function ScrollingActivity(props) {
  const {
    isTyping
  } = props;
  let typingIndicator;
  if (isTyping) {
    typingIndicator = <TypingIndicator />;
  }

  return (
    <div>
      <ActivityList {...props} />
      <div className={classNames(`indicators`, styles.indicators)}>
        {typingIndicator}
      </div>
    </div>
  );
}

ScrollingActivity.propTypes = {
  activities: PropTypes.array,
  currentUserId: PropTypes.string,
  flags: PropTypes.array,
  isTyping: PropTypes.bool,
  onActivityDelete: PropTypes.func.isRequired,
  onActivityFlag: PropTypes.func.isRequired
};

export default injectScrollable(ScrollingActivity);
