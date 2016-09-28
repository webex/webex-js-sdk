import React, {Component, PropTypes} from 'react';

class ActivityItem extends Component {
  shouldComponentUpdate() {
    return false;
  }

  render() {
    const {activity} = this.props;
    return (
      <div>
        <li>
          {activity.activity.message}
        </li>
      </div>
    );
  }
}

ActivityItem.propTypes = {
  activity: PropTypes.object.isRequired
};

export default ActivityItem;
