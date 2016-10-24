import React from 'react';

import classNames from 'classnames';

import styles from './styles.css';

function TypingIndicator() {

  return ( // eslint-disable-line no-extra-parens
    <div className={classNames(`typing-background`, styles.background)}>
      <div className={classNames(`typing-indicator`, styles.typingIndicator)}>
        <div className={classNames(`sq`, styles.sq)} /><div className={classNames(`sq`, styles.sq)} /><div className={classNames(`sq`, styles.sq)} />
      </div>
    </div>
  );
}

export default TypingIndicator;
