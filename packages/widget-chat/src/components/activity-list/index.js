import React, {PropTypes} from 'react';
import classNames from 'classnames';
import ActivityItem from '../activity-item';

import styles from './styles.css';

const filteredVerbs = [`create`, `tombstone`, `delete`];

export default function ActivityList(props) {
  const filteredActivities = props.activities
    .filter((activity) =>
      filteredVerbs.indexOf(activity.verb) === -1
    );
  const activities = filteredActivities
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
