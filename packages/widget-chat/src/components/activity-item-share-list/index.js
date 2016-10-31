import React, {PropTypes} from 'react';
import classNames from 'classnames';

import injectFileDownloader from '../../containers/file-downloader';
import ActivityItemBase from '../activity-item-base';
import ShareItem from '../activity-item-share-item';
import ShareThumbnail from '../activity-item-share-thumbnail';
import styles from './styles.css';

function ActivityItemShareList(props) {
  const {
    files,
    onDownloadClick,
    share
  } = props;

  const items = files.map((file) => {
    if (file.image && share.files[file.image.url]) {
      return (
        <ShareThumbnail
          file={file}
          key={file.url}
          onDownloadClick={onDownloadClick}
          thumbnail={share.files[file.image.url]}
        />
      );
    }
    return <ShareItem file={file} key={file.url} />;
  });

  return (
    <ActivityItemBase {...props}>
      <div className={classNames(`activity-share-list`, styles.shareList)}>
        {items}
      </div>
    </ActivityItemBase>
  );
}

ActivityItemShareList.propTypes = {
  files: PropTypes.array,
  onDownloadClick: PropTypes.func,
  share: PropTypes.object
};

export default injectFileDownloader(ActivityItemShareList);
