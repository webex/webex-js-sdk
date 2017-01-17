import React, {PropTypes} from 'react';
import classNames from 'classnames';

import {FormattedMessage} from 'react-intl';

import styles from './styles.css';

export const SYSTEM_MESSAGE_VERB_TOMBSTONE = `tombstone`;
export const SYSTEM_MESSAGE_VERB_CREATE = `create`;
export const SYSTEM_MESSAGE_VERBS = [SYSTEM_MESSAGE_VERB_CREATE, SYSTEM_MESSAGE_VERB_TOMBSTONE];

export default function ActivityItemSystemMessage(props) {
  const {
    isSelf,
    name,
    timestamp,
    verb
  } = props;

  let systemMessage;

  if (verb === SYSTEM_MESSAGE_VERB_CREATE) {
    if (isSelf) {
      systemMessage = ( // eslint-disable-line no-extra-parens
        <FormattedMessage
          defaultMessage={`You created conversation.`}
          id={`youCreatedConversation`}
        />);
    }
    else {
      systemMessage = ( // eslint-disable-line no-extra-parens
        <FormattedMessage
          defaultMessage={`{name} created conversation.`}
          id={`someoneElseCreatedConversation`}
          values={{name}}
        />);
    }
  }
  else if (verb === SYSTEM_MESSAGE_VERB_TOMBSTONE) {
    if (isSelf) {
      systemMessage = ( // eslint-disable-line no-extra-parens
        <FormattedMessage
          defaultMessage={`You deleted your message.`}
          id={`youDeletedYourMessage`}
        />);
    }
    else {
      systemMessage = ( // eslint-disable-line no-extra-parens
        <FormattedMessage
          defaultMessage={`{name} deleted their own message.`}
          id={`someoneDeletedTheirMessage`}
          values={{name}}
        />);
    }
  }

  return (
    <div className={classNames(`system-message`, styles.systemMessage)}>
      {systemMessage} {timestamp}
    </div>
  );
}

ActivityItemSystemMessage.propTypes = {
  isSelf: PropTypes.bool,
  name: PropTypes.string.isRequired,
  timestamp: PropTypes.string,
  verb: PropTypes.string.isRequired
};

