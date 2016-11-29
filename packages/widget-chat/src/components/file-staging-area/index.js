import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Button from '../button';
import Chip from '../chip';

import styles from './styles.css';

export default function FileStagingArea(props) {
  const {
    onFileDelete,
    onSubmit,
    files
  } = props;
  const fileChips = [];

  if (files && Object.keys(files).length) {
    files.forEach((file) => {
      fileChips.push(
        <Chip
          fileName={file.name}
          fileType={file.fileType}
          id={file.id}
          key={file.id}
          onDelete={onFileDelete}
        />
      );
    });
  }

  return (
    <div className={classNames(`file-staging-area`, styles.fileStagingArea)}>
      {fileChips}
      <Button label="Share" onClick={onSubmit} />
    </div>
  );
}

FileStagingArea.propTypes = {
  files: PropTypes.object,
  onFileDelete: PropTypes.func,
  onSubmit: PropTypes.func
};
