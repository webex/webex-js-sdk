import React, {Component, PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

import Avatar from '../avatar';

class TitleBar extends Component {
  shouldComponentUpdate(nextProps) {
    return this.props.user !== nextProps.user;
  }

  render() {
    const {user} = this.props;
    const {displayName} = this.props.user;
    return (
      <div className={classNames(`title-bar`, styles.titleBar)}>
        <Avatar user={user} />
        <h2 className={classNames(`title`, styles.title)}>{displayName}</h2>
      </div>
    );
  }
}

TitleBar.propTypes = {
  user: PropTypes.object.isRequired
};

export default TitleBar;
