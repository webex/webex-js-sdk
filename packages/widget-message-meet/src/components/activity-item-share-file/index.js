import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Button from '../button';
import Icon, {ICON_TYPE_DOWNLOAD, ICON_TYPE_DOCUMENT} from '../icon';
import {bytesToSize} from '../../utils/files';
import styles from './styles.css';

function ActivityItemShareFile(props) {
  const {
    file,
    isPending,
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

  let shareActions = ``;
  if (!isPending) {
    // eslint-disable-next-line no-extra-parens
    shareActions = (
      <div className={classNames(`share-item-actions`, styles.shareActions)}>
        <div className={classNames(`share-action-item`, styles.shareActionItem)}>
          <Button
            buttonClassName={styles.downloadButton}
            iconType={ICON_TYPE_DOWNLOAD}
            onClick={handleDownloadClick}
            title="Download this file"
          />
        </div>
      </div>
    );
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
        {shareActions}
      </div>
    </div>
  );
}

ActivityItemShareFile.propTypes = {
  file: PropTypes.object,
  isPending: PropTypes.bool,
  onDownloadClick: PropTypes.func
};

export default ActivityItemShareFile;
