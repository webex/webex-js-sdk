import React, {PropTypes} from 'react';
import classNames from 'classnames';

import IconButton from '../icon-button';
import {ICON_TYPE_DELETE} from '../icon';
import styles from './styles.css';

export default function ActivityItemPostActions(props) {
  function handleOnDelete() {
    const {id, onDelete} = props;
    onDelete(id);
  }

  const actions = [];
  if (props.showDelete) {
    actions.push(
      {
        handleOnClick: handleOnDelete,
        title: `Delete this message`,
        type: ICON_TYPE_DELETE
      });
  }

  const actionItems = actions.map((action, index) =>
    <div className={classNames(`post-actions-item`, styles.postActionsItem)} key={index}>
      <IconButton onClick={action.handleOnClick} title={action.title} type={action.type} />
    </div>
  );

  return (
    <div className={classNames(`post-actions`, styles.postActions)}>
      {actionItems}
    </div>
  );
}

ActivityItemPostActions.propTypes = {
  id: PropTypes.string.isRequired,
  onDelete: PropTypes.func,
  showDelete: PropTypes.bool.isRequired
};
