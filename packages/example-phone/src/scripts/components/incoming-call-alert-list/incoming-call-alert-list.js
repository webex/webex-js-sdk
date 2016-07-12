import React from 'react';

import IncomingCallAlert from './incoming-call-alert';

export default function IncomingCallAlertList({calls, ...rest}) {
  if (!calls) {
    return null;
  }
  return (
    <div>
      <IncomingCallAlert call={calls[0]} {...rest} />
    </div>
  );
}

IncomingCallAlertList.propTypes = {
  calls: React.PropTypes.array.isRequired
};
