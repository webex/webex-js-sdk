import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Icon from '../icon';

import styles from './styles.css';

export default function ActivityItemPostActions(props) {
  function handleOnDelete() {
    const {id, onDelete} = props;
    onDelete(id);
  }

  return (
    <div className={classNames(`post-actions`, styles.postActions)}>
      <Icon handleOnClick={handleOnDelete} type="delete" />
    </div>
  );
}

ActivityItemPostActions.propTypes = {
  id: PropTypes.string.isRequired,
  onDelete: PropTypes.func
};
