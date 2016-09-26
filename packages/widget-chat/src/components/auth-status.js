import React from 'react';

export default function AuthStatus(props) {
  let message;

  if (props.spark.isAuthenticated) {
    message = `authenticated`;
  }
  else if (props.spark.isAuthenticating) {
    message = `authenticating`;
  }
  else {
    message = `not authenticated`;
  }

  return <span className="authentication-status">{message}</span>;
}

AuthStatus.propTypes = {
  spark: React.PropTypes.object.isRequired
};
