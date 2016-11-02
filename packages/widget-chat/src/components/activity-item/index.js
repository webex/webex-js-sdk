import React, {PropTypes} from 'react';
import classNames from 'classnames';
import ActivityItemPost from '../activity-item-post';
import ActivityItemShareList from '../activity-item-share-list';
import ActivityItemSystemMessage, {SYSTEM_MESSAGE_VERBS} from '../activity-item-system-message';

import styles from './styles.css';

const POST_VERB = `post`;
const SHARE_VERB = `share`;

export default function ActivityItem(props) {
  const {
    activity,
    verb
  } = props;

  let itemComponent = ``;

  if (verb === POST_VERB) {
    itemComponent = <ActivityItemPost content={activity.displayName} {...props} />;
  }
  else if (verb === SHARE_VERB) {
    itemComponent = <ActivityItemShareList files={activity.files.items} {...props} />;
  }
  else if (SYSTEM_MESSAGE_VERBS.indexOf(verb) !== -1) {
    itemComponent = <ActivityItemSystemMessage content={activity.displayName} {...props} />;
  }

  return (
    <div className={classNames(`activity-item-container`, styles.activityItemContainer)}>
      {itemComponent}
    </div>
  );
}

ActivityItem.propTypes = {
  activity: PropTypes.object,
  avatar: PropTypes.element,
  id: PropTypes.string.isRequired,
  isAdditional: PropTypes.bool,
  isSelf: PropTypes.bool,
  name: PropTypes.string.isRequired,
  onActivityDelete: PropTypes.func,
  timestamp: PropTypes.string,
  verb: PropTypes.string.isRequired
};
