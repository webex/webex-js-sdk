import React, {PropTypes} from 'react';

export default function ActivityItem(props) {
  const {activity} = props;
  return (
    <div>
      <li>
        {activity.id} - {activity.object.displayName}
      </li>
    </div>
  );
}

ActivityItem.propTypes = {
  activity: PropTypes.object.isRequired
};
