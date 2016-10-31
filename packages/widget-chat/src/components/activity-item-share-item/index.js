import React, {PropTypes} from 'react';
import classNames from 'classnames';
import {bytesToSize} from '../../utils/files';
import styles from './styles.css';

function ActivityItemShareItem(props) {
  const {
    displayName,
    fileSize,
    mimeType,
    objectType
  } = props.file;

  return (
    <div className={classNames(`activity-share-item`, styles.shareItem)}>
      <div className={classNames(`share-name`, styles.name)}>{displayName}</div>
      <div className={classNames(`share-file-size`, styles.fileSize)}>{bytesToSize(fileSize)}</div>
      <div className={classNames(`share-mime-type`, styles.mimeType)}>{mimeType}</div>
      <div className={classNames(`share-file-type`, styles.fileType)}>{objectType}</div>
    </div>
  );
}

ActivityItemShareItem.propTypes = {
  file: PropTypes.object
};

export default ActivityItemShareItem;
