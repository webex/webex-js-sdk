import React, {PropTypes} from 'react';

export default function ActivityItemPostActions(props) {
  function handleOnDelete() {
    const {id, onDelete} = props;
    onDelete(id);
  }

  return (
    <div>
      <button onClick={handleOnDelete}>DELETE</button>
    </div>
  );
}

ActivityItemPostActions.propTypes = {
  id: PropTypes.string.isRequired,
  onDelete: PropTypes.func
};
