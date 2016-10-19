import React, {PropTypes} from 'react';
import classNames from 'classnames';

import IconButton from '../icon-button';

import styles from './styles.css';

export default function ActivityItemPostActions(props) {
  function handleOnDelete() {
    const {id, onDelete} = props;
    onDelete(id);
  }

  const actions = [];
  if (props.isSelf) {
    actions.push(
      <div className={classNames(`post-actions-item`, styles.postActionsItem)}>
        <IconButton onClick={handleOnDelete} title="Delete this message" type="delete" />
      </div>
    );
  }

  return (
    <div className={classNames(`post-actions`, styles.postActions)}>
      {actions}
    </div>
  );
}

ActivityItemPostActions.propTypes = {
  id: PropTypes.string.isRequired,
  isSelf: PropTypes.bool,
  onDelete: PropTypes.func
};
