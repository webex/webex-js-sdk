import React, {Component, PropTypes} from 'react';
import ActivityItem from '../activity-item';

class ActivityList extends Component {
  shouldComponentUpdate() {
    return false;
  }

  renderActivityItems(activities) {
    return activities.map((activity) =>
      <ActivityItem activity={activity} key={activity.id} />
    );
  }

  render() {
    const activities = this.renderActivityItems(this.props.activities);
    return (
      <div>
        <ul>
          {activities}
        </ul>
      </div>
    );
  }
}

ActivityList.propTypes = {
  activities: PropTypes.object,
  user: PropTypes.object
};

ActivityList.defaultProps = {
  activities: [
    {
      id: `abc123`,
      user: {
        userId: `adam.weeks@gmail.com`,
        isSelf: true
      },
      activity: {
        message: `hey!`
      }
    },
    {
      id: `abc124`,
      user: {
        userId: `bernie@aol.net`,
        isSelf: false
      },
      activity: {
        message: `hey, what's up?!`
      }
    }
  ],
  user: {}
};

export default ActivityList;
