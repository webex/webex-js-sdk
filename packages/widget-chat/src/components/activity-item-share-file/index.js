import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Icon from '../icon';
import IconButton from '../icon-button';
import {ICON_TYPE_DOWNLOAD, ICON_TYPE_DOCUMENT} from '../icon';
import {bytesToSize} from '../../utils/files';
import styles from './styles.css';

function ActivityItemShareFile(props) {
  const {
    file,
    onDownloadClick
  } = props;

  const {
    displayName,
    fileSize,
    objectType
  } = file;

  function handleDownloadClick() {
    onDownloadClick(file);
  }

  return (
    <div className={classNames(`activity-share-item`, styles.shareItem)}>
      <div className={classNames(`share-file-icon`, styles.fileIcon)}>
        <Icon type={ICON_TYPE_DOCUMENT} />
      </div>
      <div className={classNames(`share-meta`, styles.meta)}>
        <div className={classNames(`share-file-info`, styles.fileInfo)}>
          <div className={classNames(`share-name`, styles.name)}>{displayName}</div>
          <div className={classNames(`share-file-props`, styles.fileProps)}>
            <span className={classNames(`share-file-size`, styles.fileSize)}>{bytesToSize(fileSize)}</span>
            <span className={classNames(`share-file-type`, styles.fileType)}>{objectType}</span>
          </div>
        </div>
        <div className={classNames(`share-item-actions`, styles.shareActions)}>
          <div className={classNames(`share-action-item`, styles.shareActionItem)}>
            <IconButton
              buttonClassName={styles.downloadButton}
              onClick={handleDownloadClick}
              title="Download this file"
              type={ICON_TYPE_DOWNLOAD}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

ActivityItemShareFile.propTypes = {
  file: PropTypes.object,
  onDownloadClick: PropTypes.func
};

export default ActivityItemShareFile;
