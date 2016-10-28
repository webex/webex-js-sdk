import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Avatar from '../avatar';
import ActivityItemPostAction from '../activity-item-post-action';
import styles from './styles.css';

import {ICON_TYPE_DELETE, ICON_TYPE_FLAGGED_OUTLINE} from '../icon';

export default function ActivityItemPost(props) {
  function handleOnDelete() {
    const {id, onActivityDelete} = props;
    onActivityDelete(id);
  }

  function handleOnFlag() {
    const {id, onActivityFlag} = props;
    onActivityFlag(id);
  }

  function wrapActionItem(action, highlight) { // eslint-disable-line react/no-multi-comp
    const actionClassNames = [`activity-post-action`, styles.activityPostAction];
    if (highlight) {
      actionClassNames.push(`activity-post-action-highlighted`, styles.activityPostActionHighlighted);
    }
    return (
      <div className={classNames(actionClassNames)}>
        {action}
      </div>
    );
  }

  const {
    content,
    isAdditional,
    isFlagged,
    isSelf,
    name,
    timestamp
  } = props;

  let deleteAction;
  if (isSelf) {
    deleteAction = <ActivityItemPostAction iconType={ICON_TYPE_DELETE} onClick={handleOnDelete} title="Delete this message" />
  }
  else {
    deleteAction = <div className={classNames(`action-spacer`, styles.actionSpacer)} />;
  }
  deleteAction = wrapActionItem(deleteAction, false);

  let flagAction = <ActivityItemPostAction iconType={ICON_TYPE_FLAGGED_OUTLINE} onClick={handleOnFlag} title="Flag this message" />;
  flagAction = wrapActionItem(flagAction, isFlagged);


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
        {flagAction}
        {deleteAction}
      </div>
    </div>
  );
}

ActivityItemPost.propTypes = {
  avatar: PropTypes.element,
  content: PropTypes.string,
  id: PropTypes.string.isRequired,
  isAdditional: PropTypes.bool,
  isFlagged: PropTypes.bool,
  isSelf: PropTypes.bool,
  name: PropTypes.string.isRequired,
  onActivityDelete: PropTypes.func,
  onActivityFlag: PropTypes.func,
  timestamp: PropTypes.string
};
