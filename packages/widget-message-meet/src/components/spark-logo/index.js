import React from 'react';
import classNames from 'classnames';
import styles from './styles.css';

// eslint-disable-next-line func-style,arrow-body-style
const SparkLogo = () => {
  return (
    <div className={classNames(`spark-logo`, styles.logo)} />
  );
};

export default SparkLogo;
