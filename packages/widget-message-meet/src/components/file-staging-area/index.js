import React, {PropTypes} from 'react';
import classNames from 'classnames';

import {bytesToSize, getFileType} from '../../utils/files';

import Button from '../button';
import ChipFile from '../chip-file';

import styles from './styles.css';

export default function FileStagingArea(props) {
  const {
    onFileRemove,
    onSubmit,
    files
  } = props;
  const fileChips = [];

  if (files && Object.keys(files).length) {
    files.forEach((file) => {
      const chipProps = {
        name: file.name,
        type: getFileType(file.type),
        size: bytesToSize(file.fileSize),
        id: file.id,
        onRemove: onFileRemove,
        thumbnail: file.thumbnail
      };

      fileChips.push(<div className={classNames(`chip-container`, styles.chipContainer)} key={file.id}><ChipFile {...chipProps} /></div>);
    });
  }

  return (
    <div className={classNames(`file-staging-area`, styles.fileStagingArea)}>
      <div className={classNames(`staged-files`, styles.files)}>
        {fileChips}
      </div>
      <div className={classNames(`staging-actions`, styles.actions)}>
        <Button label="Share" onClick={onSubmit} />
      </div>
    </div>
  );
}

FileStagingArea.propTypes = {
  files: PropTypes.object,
  onFileRemove: PropTypes.func,
  onSubmit: PropTypes.func
};
