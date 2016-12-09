import React from 'react';
import classNames from 'classnames';

import styles from './styles.css';

export default function spinner() {
  return <div className={classNames(`spinner`, styles.spinner)} />;
}
