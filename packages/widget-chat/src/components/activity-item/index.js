import React, {PropTypes} from 'react';
import classNames from 'classnames';
import ActivityItemPost from '../activity-item-post';

import styles from './styles.css';

export default function ActivityItem(props) {
  const {
    verb
  } = props;

  let itemComponent;

  switch (verb) {
  case `post`:
    itemComponent = <ActivityItemPost {...props} />;
    break;
  default:
    itemComponent = ``;
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
  name: PropTypes.string.isRequired,
  timestamp: PropTypes.string,
  verb: PropTypes.string.isRequired
};
