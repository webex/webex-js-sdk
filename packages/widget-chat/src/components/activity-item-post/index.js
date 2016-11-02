import React, {PropTypes} from 'react';
import classNames from 'classnames';

import ActivityItemBase from '../activity-item-base';
import styles from './styles.css';

export default function ActivityItemPost(props) {

  const {
    content
  } = props;

  return (
    <ActivityItemBase {...props}>
      <div className={classNames(`activity-text`, styles.activityText)}>
        {content}
      </div>
    </ActivityItemBase>
  );
}

ActivityItemPost.propTypes = {
  content: PropTypes.string
};
