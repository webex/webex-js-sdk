import React, {Component, PropTypes} from 'react';
import Avatar from '../avatar';
import classNames from 'classnames';

import styles from './styles.css';

class ActivityReadReceipt extends Component {
  componentDidUpdate() {
    return false;
  }

  render() {
    const avatars = this.props.actors.map((actor) => <Avatar displayName={actor} key={actor} />);
    return (
      <div className={classNames(`activity-read-receipt`, styles.activityReadReceipt)}>
        {avatars}
      </div>
    );
  }
}

ActivityReadReceipt.propTypes = {
  actors: PropTypes.array
};

export default ActivityReadReceipt;
