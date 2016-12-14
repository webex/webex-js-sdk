import React from 'react';
import classNames from 'classnames';
import {FormattedMessage} from 'react-intl';

import Spinner from '../spinner';
import styles from './styles.css';

export default function LoadingScreen() {
  return (
    <div className={classNames(`loading`, styles.loading)}>
      <div className={classNames(`spark-logo`, styles.logo)} />
      <FormattedMessage
        defaultMessage="Connecting to Spark"
        id="connecting"
      />
      <div className={classNames(`spinner-container`, styles.spinnerContainer)}>
        <Spinner />
      </div>
    </div>
  );
}
