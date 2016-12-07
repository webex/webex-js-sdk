import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Button from '../button';
import {ICON_TYPE_DOWNLOAD} from '../icon';
import Spinner from '../spinner';
import {bytesToSize} from '../../utils/files';
import styles from './styles.css';

function ActivityItemShareThumbnail(props) {
  const {
    file,
    onDownloadClick,
    thumbnail
  } = props;
  const {
    displayName,
    fileSize,
    objectType
  } = file;

  let image;

  if (thumbnail) {
    const isFetching = thumbnail.get(`isFetching`);
    const objectUrl = thumbnail.get(`objectUrl`);
    if (!isFetching && objectUrl) {
      image = <img alt="Uploaded File" src={objectUrl} />;
    }
    else if (isFetching) {
      image = <div className={classNames(`spinner-container`, styles.spinnerContainer)}><Spinner /></div>;
    }
  }

  function handleDownloadClick() {
    onDownloadClick(file);
  }

  return (
    <div className={classNames(`activity-share-item`, styles.shareItem)}>
      <div className={classNames(`share-thumbnail`, styles.thumbnail)}>
        {image}
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
            <Button
              buttonClassName={styles.downloadButton}
              iconType={ICON_TYPE_DOWNLOAD}
              onClick={handleDownloadClick}
              title="Download this file"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

ActivityItemShareThumbnail.propTypes = {
  file: PropTypes.object,
  onDownloadClick: PropTypes.func,
  thumbnail: PropTypes.object
};

export default ActivityItemShareThumbnail;
