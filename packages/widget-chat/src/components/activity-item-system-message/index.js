import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

export const SYSTEM_MESSAGE_VERB_TOMBSTONE = `tombstone`;
export const SYSTEM_MESSAGE_VERB_CREATE = `create`;
export const SYSTEM_MESSAGE_VERBS = [SYSTEM_MESSAGE_VERB_CREATE, SYSTEM_MESSAGE_VERB_TOMBSTONE];

export default function ActivityItemSystemMessage(props) {
  const {
    name,
    timestamp,
    verb
  } = props;

  let systemMessage;

  if (verb === SYSTEM_MESSAGE_VERB_CREATE) {
    systemMessage = `${name} created conversation. ${timestamp}`;
  }
  else if (verb === SYSTEM_MESSAGE_VERB_TOMBSTONE) {
    systemMessage = `${name} deleted message. ${timestamp}`;
  }

  return (
    <div className={classNames(`system-message`, styles.systemMessage)}>
      {systemMessage}
    </div>
  );
}

ActivityItemSystemMessage.propTypes = {
  content: PropTypes.string,
  name: PropTypes.string.isRequired,
  timestamp: PropTypes.string,
  verb: PropTypes.string.isRequired
};

