import React from 'react';

export default function AuthStatus({authenticated, authenticating}) {
  let message;
  if (authenticated) {
    message = `authenticated`;
  }
  else if (authenticating) {
    message = `authenticating`;
  }
  else {
    message = `not authenticated`;
  }

  return <span className="authentication-status">{message}</span>;
}

AuthStatus.propTypes = {
  authenticated: React.PropTypes.bool.isRequired,
  authenticating: React.PropTypes.bool.isRequired
};
