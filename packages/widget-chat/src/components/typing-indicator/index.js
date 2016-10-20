import React from 'react';

import classNames from 'classnames';

import styles from './styles.css';

function TypingIndicator() {

  return ( // eslint-disable-line no-extra-parens
    <div className={classNames(`typing-background`, styles.background)}>
      <span>...</span>
    </div>
  );
}

export default TypingIndicator;
