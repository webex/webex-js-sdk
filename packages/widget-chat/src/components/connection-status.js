import React from 'react';

export default function ConnectionStatus(props) {
  let message;

  if (props.spark.mercury.connected) {
    message = `connected`;
  }
  else if (props.spark.mercury.connecting) {
    message = `connecting`;
  }
  else {
    message = `not connected`;
  }

  return <span className="connection-status">{message}</span>;
}

ConnectionStatus.propTypes = {
  spark: React.PropTypes.object.isRequired
};
