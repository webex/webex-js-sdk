import React from 'react';

export default function ConnectionStatus({connected, connecting}) {
  let message;
  if (connected) {
    message = `connected`;
  }
  else if (connecting) {
    message = `connecting`;
  }
  else {
    message = `not connected`;
  }

  return <span className="connection-status">{message}</span>;
}

ConnectionStatus.propTypes = {
  connected: React.PropTypes.bool.isRequired,
  connecting: React.PropTypes.bool.isRequired
};
