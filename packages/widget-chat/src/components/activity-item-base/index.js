import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Avatar from '../avatar';
import ActivityItemPostActions from '../activity-item-post-actions';
import styles from './styles.css';


export default function ActivityItemBase(props) {
  const {
    children,
    id,
    isAdditional,
    isSelf,
    name,
    onActivityDelete,
    timestamp
  } = props;

  const showDeleteAction = isSelf;

  return (
    <div className={classNames(`activity-item`, styles.activityItem, isAdditional ? styles.additional : ``)}>
      <div className={classNames(`avatar-wrapper`, styles.avatarWrapper)}>
        <Avatar isSelfAvatar={isSelf} name={name} />
      </div>
      <div className={classNames(`content-container`, styles.contentContainer)}>
        <div className={classNames(`meta`, styles.meta)}>
          <div className={classNames(`display-name`, styles.displayName)} title="{name}">{name}</div>
          <div className={classNames(`published`, styles.published)}>{timestamp}</div>
        </div>
        <div className={classNames(`activity-content`, styles.content)}>
          {children}
        </div>
      </div>
      <div className={classNames(`activity-post-actions`, styles.activityPostActions)} >
        <ActivityItemPostActions id={id} onDelete={onActivityDelete} showDelete={showDeleteAction} />
      </div>
    </div>
  );
}

ActivityItemBase.propTypes = {
  avatar: PropTypes.element,
  children: PropTypes.element.isRequired,
  id: PropTypes.string.isRequired,
  isAdditional: PropTypes.bool,
  isSelf: PropTypes.bool,
  name: PropTypes.string.isRequired,
  onActivityDelete: PropTypes.func,
  timestamp: PropTypes.string
};
