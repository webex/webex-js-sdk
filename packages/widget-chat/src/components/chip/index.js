import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Button from '../button';
import styles from './styles.css';


export default function Chip(props) {
  const {
    fileName,
    fileType,
    id,
    onDelete,
    thumbnail
  } = props;

  function handleDelete() {
    onDelete(id);
  }

  return (
    <div className={classNames(`chip-container`, styles.chipContainer)}>
      {thumbnail}
      {fileName}
      {fileType}
      <Button onClick={handleDelete} />
    </div>
  );
}

Chip.propTypes = {
  fileName: PropTypes.string,
  fileType: PropTypes.string,
  id: PropTypes.string,
  onDelete: PropTypes.func,
  thumbnail: PropTypes.string
};
