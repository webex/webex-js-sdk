import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Avatar from '../avatar';

import styles from './styles.css';


export default function ActivityItemPost(props) {
  const {
    content,
    name,
    timestamp
  } = props;

  return (
    <div>
      <div className={classNames(`avatar-wrapper`, styles.avatarWrapper)}>
        <Avatar name={name} />
      </div>
      <div className={classNames(styles.content)}>
        <div className={classNames(styles.meta)}>
          <div className={classNames(styles.userName)} title="{name}">{name}</div>
          <div className={classNames(styles.published)}>{timestamp}</div>
        </div>
        <div className={classNames(styles.activityText)}>{content}</div>
      </div>
    </div>
  );
}

ActivityItemPost.propTypes = {
  avatar: PropTypes.element,
  content: PropTypes.string,
  name: PropTypes.string.isRequired,
  timestamp: PropTypes.string
};

