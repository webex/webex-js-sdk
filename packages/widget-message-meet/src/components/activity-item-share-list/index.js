import React, {PropTypes} from 'react';
import classNames from 'classnames';

import injectFileDownloader from '../../containers/file-downloader';
import ActivityItemBase from '../activity-item-base';
import ActivityItemText from '../activity-item-text';
import ShareFile from '../activity-item-share-file';
import ShareThumbnail from '../activity-item-share-thumbnail';
import styles from './styles.css';

function ActivityItemShareList(props) {
  const {
    content,
    files,
    isPending,
    onDownloadClick,
    share
  } = props;

  const items = files.map((file) => {
    if (file.image) {
      let objectUrl;
      let isFetching = true;
      if (isPending) {
        objectUrl = file.thumbnail;
        isFetching = false;
      }
      else {
        const thumbnail = file.mimeType === `image/gif` ? share.getIn([`files`, file.url]) : share.getIn([`files`, file.image.url]);
        if (thumbnail) {
          isFetching = thumbnail.get(`isFetching`);
          objectUrl = thumbnail.get(`objectUrl`);
        }
      }
      return (
        <ShareThumbnail
          file={file}
          isFetching={isFetching}
          isPending={isPending}
          key={file.url}
          objectUrl={objectUrl}
          onDownloadClick={onDownloadClick}
        />
      );
    }
    return (
      <ShareFile
        file={file}
        isPending={isPending}
        key={file.url}
        onDownloadClick={onDownloadClick}
      />
    );
  });

  let textItem;
  if (content) {
    textItem = <ActivityItemText content={content} />;
  }

  return (
    <ActivityItemBase {...props}>
      <div className={classNames(`activity-share-list`, styles.shareList)}>
        {items}
        {textItem}
      </div>
    </ActivityItemBase>
  );
}

ActivityItemShareList.propTypes = {
  content: PropTypes.string,
  files: PropTypes.array,
  isPending: PropTypes.bool,
  onDownloadClick: PropTypes.func,
  share: PropTypes.object
};

export default injectFileDownloader(ActivityItemShareList);
