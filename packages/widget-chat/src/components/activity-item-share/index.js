import React, {PropTypes} from 'react';
import classNames from 'classnames';

import injectFileDownloader from '../../containers/file-downloader';
import ActivityItemBase from '../activity-item-base';
import styles from './styles.css';

function ActivityItemShare(props) {
  const {
    content
  } = props;

  return (
    <ActivityItemBase {...props}>
      <div className={classNames(`activity-share`, styles.activityText)}>
        {content}
      </div>
    </ActivityItemBase>
  );
}

ActivityItemShare.propTypes = {
  content: PropTypes.array
};

export default injectFileDownloader(ActivityItemShare);
