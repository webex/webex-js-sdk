import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

export default function AddFileButton(props) {
  const {
    onClick
  } = props;

  return (
    <button className={classNames(`add-file-button`, styles.button)} onClick={onClick}>
      <span className={classNames(`add-file-icon`, styles.icon)} />
    </button>
  );
}

AddFileButton.propTypes = {
  onClick: PropTypes.func
};
