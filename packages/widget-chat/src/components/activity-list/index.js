import React, {PropTypes} from 'react';
import classNames from 'classnames';
import ActivityItem from '../activity-item';
import injectScrollable from '../../containers/wrapper-scrollable';

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
          key={activity.id}
          name={activity.name}
          timestamp={activity.timestamp}
          verb={activity.verb}
        />
      );
    });

  return (
    <div className={classNames(`activity-list`)}>
      {activities}
    </div>
  );
}

ActivityList.propTypes = {
  activities: PropTypes.array
};

export default injectScrollable(ActivityList);
