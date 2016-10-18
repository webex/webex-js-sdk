import React, {PropTypes} from 'react';
import classNames from 'classnames';
import ActivityItem from '../activity-item';
import injectScrollable from '../../containers/wrapper-scrollable';

import styles from './styles.css';

function ActivityList(props) {
  let lastActorId;
  const activities = props.activities
    .map((activity) => {
      const additional = lastActorId === activity.actorId;
      lastActorId = activity.actorId;
      return (
        <ActivityItem
          content={activity.content}
          isAdditional={additional}
          isSelf={props.currentUserId === activity.actorId}
          key={activity.id}
          name={activity.name}
          timestamp={activity.timestamp}
          verb={activity.verb}
        />
      );
    });

  return (
    <div className={classNames(`activity-list`, styles.activityList)}>
      {activities}
    </div>
  );
}

ActivityList.propTypes = {
  activities: PropTypes.array,
  currentUserId: PropTypes.string
};

export default injectScrollable(ActivityList);
