import React, {Component, PropTypes} from 'react';
import Avatar from '../avatar';
import classNames from 'classnames';

import styles from './styles.css';

class ActivityReadReceipt extends Component {
  componentDidUpdate() {
    return false;
  }

  render() {
    const avatars = this.props.actors.map((actor) => <Avatar key={actor} name={actor} />);
    return (
      <div className={classNames(`activity-read-receipt`, styles.activityReadReceipt)}>
        {avatars}
      </div>
    );
  }
}

ActivityReadReceipt.propTypes = {
  actors: PropTypes.arrayOf(PropTypes.string)
};

export default ActivityReadReceipt;
