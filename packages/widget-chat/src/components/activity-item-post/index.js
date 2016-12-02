import React, {PropTypes} from 'react';

import ActivityItemBase from '../activity-item-base';
import ActivityItemText from '../activity-item-text';

export default function ActivityItemPost(props) {

  const {
    content
  } = props;

  return (
    <ActivityItemBase {...props}>
      <ActivityItemText content={content} />
    </ActivityItemBase>
  );
  /* eslint-enable react/no-danger */
}

ActivityItemPost.propTypes = {
  content: PropTypes.string
};
