import React from 'react';
import classNames from 'classnames';

import styles from './styles.css';

export default function ConnectionStatus({connected, connecting}) {
  let state;
  if (connected) {
    state = styles.connected;
  }
  else if (connecting) {
    state = styles.connecting;
  }
  else {
    state = styles.disconnected;
  }

  return <span className={classNames(`connection-status`, styles.connectionStatus, state)} />;
}

ConnectionStatus.propTypes = {
  connected: React.PropTypes.bool,
  connecting: React.PropTypes.bool
};
