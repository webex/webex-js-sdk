import React, {PropTypes} from 'react';
import classNames from 'classnames';

import ActivityItemBase from '../activity-item-base';
import styles from './styles.css';

export default function ActivityItemPost(props) {

  const {
    content
  } = props;

  /* eslint-disable-reason content is considered safe from server */
  /* eslint-disable react/no-danger */
  const htmlContent = {__html: content};
  return (
    <ActivityItemBase {...props}>
      <div
        className={classNames(`activity-text`, styles.activityText)}
        dangerouslySetInnerHTML={htmlContent}
      />
    </ActivityItemBase>
  );
  /* eslint-enable react/no-danger */
}

ActivityItemPost.propTypes = {
  content: PropTypes.string
};
