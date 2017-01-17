import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Avatar from '../avatar';
import ActivityItemPostAction from '../activity-item-post-action';
import styles from './styles.css';

import {ICON_TYPE_DELETE, ICON_TYPE_FLAGGED_OUTLINE} from '../icon';


export default function ActivityItemBase(props) {

  const {
    avatarUrl,
    children,
    id,
    isAdditional,
    isFlagged,
    isSelf,
    name,
    onActivityDelete,
    onActivityFlag,
    timestamp
  } = props;

  let deleteAction;

  function handleOnDelete() {
    onActivityDelete(id);
  }

  function handleOnFlag() {
    onActivityFlag(id);
  }

  function getActionClassNames(highlight) {
    const actionClassNames = [`activity-post-action`, styles.activityPostAction];
    if (highlight) {
      actionClassNames.push(`isHighlighted`, styles.isHighlighted);
    }
    return actionClassNames;
  }

  if (isSelf) {
    deleteAction = ( // eslint-disable-line no-extra-parens
      <div className={classNames(getActionClassNames())}>
        <ActivityItemPostAction
          iconType={ICON_TYPE_DELETE}
          onClick={handleOnDelete}
          title="Delete this message"
        />
      </div>
    );
  }
  else {
    deleteAction = ( // eslint-disable-line no-extra-parens
      <div className={classNames(getActionClassNames())}>
        <div className={classNames(`action-spacer`, styles.actionSpacer)} />
      </div>
    );
  }

  const flagAction = ( // eslint-disable-line no-extra-parens
    <div className={classNames(getActionClassNames(isFlagged))}>
      <ActivityItemPostAction
        iconType={ICON_TYPE_FLAGGED_OUTLINE}
        onClick={handleOnFlag}
        title="Flag this message"
      />
    </div>
  );

  return (
    <div className={classNames(`activity-item`, styles.activityItem, isAdditional ? styles.additional : ``)}>
      <div className={classNames(`avatar-wrapper`, styles.avatarWrapper)}>
        <Avatar image={avatarUrl} isSelfAvatar={isSelf} name={name} />
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
        {flagAction}
        {deleteAction}
      </div>
    </div>
  );
}

ActivityItemBase.propTypes = {
  avatarUrl: PropTypes.string,
  children: PropTypes.element.isRequired,
  id: PropTypes.string.isRequired,
  isAdditional: PropTypes.bool,
  isFlagged: PropTypes.bool,
  isSelf: PropTypes.bool,
  name: PropTypes.string.isRequired,
  onActivityDelete: PropTypes.func,
  onActivityFlag: PropTypes.func,
  timestamp: PropTypes.string
};
