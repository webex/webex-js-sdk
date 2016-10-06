import React, {PropTypes} from 'react';
import Avatar from '../avatar';

export default function ActivityItem(props) {
  const {
    content,
    name,
    timestamp
  } = props;

  return (
    <div>
      <Avatar name={name} />
      <div className="name">{name}</div>
      <div className="timestamp">{timestamp}</div>
      <div className="content">{content}</div>
    </div>
  );
}

ActivityItem.propTypes = {
  avatar: PropTypes.element,
  content: PropTypes.string,
  name: PropTypes.string.isRequired,
  timestamp: PropTypes.string
};
