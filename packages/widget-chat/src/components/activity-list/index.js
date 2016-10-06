import React, {PropTypes} from 'react';
import ActivityItem from '../activity-item';


export default function ActivityList(props) {
  const activities = props.activities.map((activity) =>
    <ActivityItem
      content={activity.content}
      key={activity.id}
      name={activity.name}
      timestamp={activity.timestamp}
    />
  );

  return (
    <div>
      {activities}
    </div>
  );
}

ActivityList.propTypes = {
  activities: PropTypes.array,
  participants: PropTypes.array
};
