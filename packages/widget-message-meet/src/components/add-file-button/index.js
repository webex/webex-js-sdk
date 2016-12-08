import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

export default function AddFileButton(props) {
  const {
    onChange
  } = props;

  return (
    <div className={classNames(`add-file-container`, styles.container)}>
      <button className={classNames(`add-file-button`, styles.button)}>
        <span className={classNames(`add-file-icon`, styles.icon)} />
      </button>
      <input
        className={classNames(`file-input`, styles.fileInput)}
        multiple="multiple"
        onChange={onChange}
        type="file"
      />
    </div>
  );
}

AddFileButton.propTypes = {
  onChange: PropTypes.func
};
