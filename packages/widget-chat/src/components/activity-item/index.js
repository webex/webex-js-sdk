import React, {PropTypes} from 'react';
import classNames from 'classnames';
import ActivityItemPost from '../activity-item-post';
import ActivityItemSystemMessage, {SYSTEM_MESSAGE_VERBS} from '../activity-item-system-message';

import styles from './styles.css';

const POST_VERB = `post`;

export default function ActivityItem(props) {
  const {
    verb
  } = props;

  let itemComponent = ``;

  if (verb === POST_VERB) {
    itemComponent = <ActivityItemPost {...props} />;
  }
  else if (SYSTEM_MESSAGE_VERBS.indexOf(verb) !== -1) {
    itemComponent = <ActivityItemSystemMessage {...props} />;
  }

  return (
    <div className={classNames(`activity-item`, styles.activityItem)}>
      {itemComponent}
    </div>
  );
}

ActivityItem.propTypes = {
  avatar: PropTypes.element,
  content: PropTypes.string,
  isAdditional: PropTypes.bool,
  name: PropTypes.string.isRequired,
  timestamp: PropTypes.string,
  verb: PropTypes.string.isRequired
};
