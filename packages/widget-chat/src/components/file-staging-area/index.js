import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Button from '../button';

import styles from './styles.css';

export default function FileStagingArea(props) {
  return (
    <div className={classNames(`file-staging-area-container`, styles.container)}>
      <Button label="Share" onClick={props.handleSubmit} />
    </div>
  );
}

FileStagingArea.propTypes = {
  files: PropTypes.array,
  handleSubmit: PropTypes.func
};
