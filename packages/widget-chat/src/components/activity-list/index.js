import React, {PropTypes} from 'react';
import classNames from 'classnames';
import ActivityItem from '../activity-item';

import styles from './styles.css';

export default function ActivityList(props) {
  const activities = props.activities
    .map((activity) =>
      <ActivityItem
        content={activity.content}
        key={activity.id}
        name={activity.name}
        timestamp={activity.timestamp}
        verb={activity.verb}
      />
    );

  return (
    <div className={classNames(`activity-list`, styles.activityList)}>
      {activities}
    </div>
  );
}

ActivityList.propTypes = {
  activities: PropTypes.array
};
