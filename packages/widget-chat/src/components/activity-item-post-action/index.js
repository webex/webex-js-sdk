import React, {PropTypes} from 'react';
import classNames from 'classnames';

import IconButton from '../icon-button';
import styles from './styles.css';

export default function ActivityItemPostAction(props) {
  return (
    <div className={classNames(`post-action-item`, styles.postActionItem)}>
      <IconButton onClick={props.onClick} title={props.title} type={props.iconType} />
    </div>
  );
}

ActivityItemPostAction.propTypes = {
  iconType: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  title: PropTypes.string
};
