import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

import Avatar from '../avatar';
import ConnectionStatus from '../connection-status';


export default function TitleBar({connectionStatus, displayName}) {
  return (
    <div className={classNames(`title-bar`, styles.titleBar)}>
      <div className={classNames(`avatar-container`, styles.avatarContainer)}>
        <Avatar name={displayName} />
      </div>
      <h1 className={classNames(`title`, styles.title)}>{displayName}</h1>
      <div className={classNames(`connection-status-container`, styles.connectionStatusContainer)}>
        <ConnectionStatus {...connectionStatus} />
      </div>
    </div>
  );
}

TitleBar.propTypes = {
  connectionStatus: PropTypes.object,
  displayName: PropTypes.string.isRequired
};
