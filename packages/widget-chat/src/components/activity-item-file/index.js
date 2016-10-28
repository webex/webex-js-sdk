import React, {PropTypes} from 'react';
import classNames from 'classnames';

import ActivityItemBase from '../activity-item-base';
import styles from './styles.css';

export default function ActivityItemFile(props) {
  const {
    content
  } = props;

  const files = content.map((file) => {
    if (file.image && file.image.src) {
      return <div key={file.url}>{file.displayName} - {file.url} <img src={file.image.src.loc} /></div>;
    }
    return <div key={file.url}>{file.displayName} - {file.url}</div>;
  });

  return (
    <ActivityItemBase {...props}>
      <div className={classNames(`activity-share`, styles.activityText)}>
        {files}
      </div>
    </ActivityItemBase>
  );
}

ActivityItemFile.propTypes = {
  fileName: PropTypes.string,
  fileType: PropTypes.string,
  image: PropTypes.element,
  onClick: PropTypes.func,
  size: PropTypes.string
};
