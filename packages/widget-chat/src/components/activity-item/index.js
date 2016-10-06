import React, {PropTypes} from 'react';

export default function ActivityItem(props) {
  const {
    content,
    id
  } = props;

  return (
    <div>
      <li>
        {id} - {content}
      </li>
    </div>
  );
}

ActivityItem.propTypes = {
  content: PropTypes.string,
  id: PropTypes.string.isRequired
};
