import React, {PropTypes} from 'react';
import classNames from 'classnames';

import IconButton from '../icon-button';
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

  let image, thumbnailSize;

  if (thumbnail && !thumbnail.status.isDownloading && thumbnail.objectUrl) {
    thumbnailSize = {
      height: file.image.height || `100%`,
      width: file.image.width || `100%`
    };
    image = <img src={thumbnail.objectUrl} />;
  }
  else if (thumbnail.status.isDownloading) {
    image = <div className={classNames(`spinner-container`, styles.spinnerContainer)}><Spinner /></div>;
  }

  function handleDownloadClick() {
    onDownloadClick(file);
  }

  return (
    <div className={classNames(`activity-share-item`, styles.shareItem)} style={thumbnailSize} >
      <div className={classNames(`share-thumbnail`, styles.thumbnail)}>
        {image}
      </div>
      <div className={classNames(`share-meta`, styles.meta)}>
        <div className={classNames(`share-name`, styles.name)}>{displayName}</div>
        <div className={classNames(`share-file-info`, styles.fileInfo)}>
          <span className={classNames(`share-file-size`, styles.fileSize)}>{bytesToSize(fileSize)}</span>
          <span className={classNames(`share-file-type`, styles.fileType)}>{objectType}</span>
        </div>
        <div className={classNames(`share-item-actions`, styles.shareActions)}>
          <div className={classNames(`post-actions-item`, styles.postActionsItem)}>
            <IconButton onClick={handleDownloadClick} title="Download this file" type={ICON_TYPE_DOWNLOAD} />
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
