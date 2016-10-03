import React, {PropTypes} from 'react';
import ActivityItem from '../activity-item';


export default function ActivityList(props) {
  const activities = props.activities.map((activity) =>
    <ActivityItem activity={activity} key={activity.id} />
  );

  return (
    <div>
      <ul>
        {activities}
      </ul>
    </div>
  );
}

ActivityList.propTypes = {
  activities: PropTypes.array,
  participants: PropTypes.array
};
