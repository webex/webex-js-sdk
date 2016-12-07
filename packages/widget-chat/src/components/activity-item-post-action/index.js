import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Button from '../button';
import styles from './styles.css';

export default function ActivityItemPostAction(props) {
  return (
    <div className={classNames(`post-action-item`, styles.postActionItem)}>
      <Button iconType={props.iconType} onClick={props.onClick} title={props.title} />
    </div>
  );
}

ActivityItemPostAction.propTypes = {
  iconType: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  title: PropTypes.string
};
