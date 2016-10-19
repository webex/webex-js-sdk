import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Avatar from '../avatar';
import ActivityItemPostActions from '../activity-item-post-actions';
import styles from './styles.css';


export default function ActivityItemPost(props) {
  const {
    content,
    id,
    isAdditional,
    isSelf,
    name,
    onActivityDelete,
    timestamp
  } = props;

  return (
    <div className={classNames(`activity-post`, styles.post, isAdditional ? styles.additional : ``)}>
      <div className={classNames(`avatar-wrapper`, styles.avatarWrapper)}>
        <Avatar isSelfAvatar={isSelf} name={name} />
      </div>
      <div className={classNames(styles.content)}>
        <div className={classNames(`meta`, styles.meta)}>
          <div className={classNames(`display-name`, styles.displayName)} title="{name}">{name}</div>
          <div className={classNames(`published`, styles.published)}>{timestamp}</div>
        </div>
        <div className={classNames(`activity-text`, styles.activityText)}>{content}</div>
      </div>
      <div className={classNames(`activity-post-actions`, styles.activityPostActions)} >
        <ActivityItemPostActions id={id} isSelf={isSelf} onDelete={onActivityDelete} />
      </div>
    </div>
  );
}

ActivityItemPost.propTypes = {
  avatar: PropTypes.element,
  content: PropTypes.string,
  id: PropTypes.string.isRequired,
  isAdditional: PropTypes.bool,
  isSelf: PropTypes.bool,
  name: PropTypes.string.isRequired,
  onActivityDelete: PropTypes.func,
  timestamp: PropTypes.string
};
