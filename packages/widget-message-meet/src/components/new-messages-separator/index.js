import React from 'react';
import {FormattedMessage} from 'react-intl';

import ListSeparator from '../list-separator';

function NewMessageSeparator() {
  const newMessages = ( // eslint-disable-line no-extra-parens
    <FormattedMessage
      defaultMessage={`NEW MESSAGES`}
      description={`Indicator to display that new, unread messages follow`}
      id={`newMessages`}
    />
  );

  return (
    <div>
      <ListSeparator isInformative primaryText={newMessages} />
    </div>
  );
}

export default NewMessageSeparator;
