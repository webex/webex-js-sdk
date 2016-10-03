import React, {Component, PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

class Avatar extends Component {
  shouldComponentUpdate() {
    return false;
  }

  render() {
    const userInitial = this.props.user.displayName.substr(0, 1).toUpperCase();
    return (
      <div className={classNames(`avatar-letter`, styles.avatarLetter)}>
        <strong>{userInitial}</strong>
      </div>
    );
  }
}

Avatar.propTypes = {
  user: PropTypes.object.isRequired
};

export default Avatar;
