import React from 'react';
import classNames from 'classnames';
import styles from './styles.css';

import logo from './logo-spark.png';

// eslint-disable-next-line func-style,arrow-body-style
const SparkLogo = () => {
  return (
    <div className={classNames(`spark-logo`, styles.logo)}>
      <img role="presentation" src={logo} />
    </div>
  );
};

export default SparkLogo;
