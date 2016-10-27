import React, {PropTypes} from 'react';
import classNames from 'classnames';

import IconButton from '../icon-button';
import {ICON_TYPE_DELETE, ICON_TYPE_FLAGGED_OUTLINE} from '../icon';
import styles from './styles.css';

export default function ActivityItemPostActions(props) {
  function handleOnDelete() {
    const {id, onDelete} = props;
    onDelete(id);
  }

  function handleOnFlag() {
    const {id, onFlag} = props;
    onFlag(id);
  }

  const actions = [
    {
      handleOnClick: handleOnFlag,
      title: `Flag this message`,
      type: ICON_TYPE_FLAGGED_OUTLINE,
      className: props.isFlagged ? `highlighted` : ``
    }
  ];
  if (props.showDelete) {
    actions.push(
      {
        handleOnClick: handleOnDelete,
        title: `Delete this message`,
        type: ICON_TYPE_DELETE
      });
  }
  const actionItems = actions.map((action, index) => {
    const actionClassNames = [`post-actions-item`, styles.postActionsItem];
    if (action.className) {
      actionClassNames.push(action.className, styles[action.className]);
    }
    return (
      <div className={classNames(actionClassNames)} key={index}>
        <IconButton onClick={action.handleOnClick} title={action.title} type={action.type} />
      </div>
    );
  });

  return (
    <div className={classNames(`post-actions`, styles.postActions)}>
      {actionItems}
    </div>
  );
}

ActivityItemPostActions.propTypes = {
  id: PropTypes.string.isRequired,
  isFlagged: PropTypes.bool,
  onDelete: PropTypes.func,
  onFlag: PropTypes.func,
  showDelete: PropTypes.bool.isRequired
};
