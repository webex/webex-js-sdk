import React, {PropTypes} from 'react';
import classNames from 'classnames';

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
  let displayName;
  let actionVerb;
  if (isSelf) {
    displayName = `You`;
    actionVerb = `your`;
  }
  else {
    displayName = name;
    actionVerb = `their own`;
  }

  if (verb === SYSTEM_MESSAGE_VERB_CREATE) {
    systemMessage = `${displayName} created conversation. ${timestamp}`;
  }
  else if (verb === SYSTEM_MESSAGE_VERB_TOMBSTONE) {
    systemMessage = `${displayName} deleted ${actionVerb} message. ${timestamp}`;
  }

  return (
    <div className={classNames(`system-message`, styles.systemMessage)}>
      {systemMessage}
    </div>
  );
}

ActivityItemSystemMessage.propTypes = {
  isSelf: PropTypes.bool,
  name: PropTypes.string.isRequired,
  timestamp: PropTypes.string,
  verb: PropTypes.string.isRequired
};

