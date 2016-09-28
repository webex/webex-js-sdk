import React, {Component, PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

import ActivityTitle from '../activity-title';
import Avatar from '../avatar';

class ActivityTitleBar extends Component {
  shouldComponentUpdate() {
    return false;
  }

  render() {
    const {user} = this.props;
    const {userId} = this.props.user;
    return (

      <div className={classNames(`activity-title-bar`, styles.activityTitleBar)}>
        <Avatar user={user} />
        <ActivityTitle heading={userId} />
      </div>
    );
  }
}

ActivityTitleBar.propTypes = {
  user: PropTypes.object.isRequired
};

export default ActivityTitleBar;
