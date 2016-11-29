import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

export default function ActivityItemText(props) {

  const {
    content
  } = props;

  /* eslint-disable-reason content is considered safe from server */
  /* eslint-disable react/no-danger */
  const htmlContent = {__html: content};
  return (
    <div
      className={classNames(`activity-text`, styles.activityText)}
      dangerouslySetInnerHTML={htmlContent}
    />
  );
  /* eslint-enable react/no-danger */
}

ActivityItemText.propTypes = {
  content: PropTypes.string
};
