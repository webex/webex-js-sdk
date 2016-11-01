import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Icon from '../icon';

import styles from './styles.css';

function IconButton(props) {
  const {
    className,
    onClick
  } = props;

  return (
    <div className={classNames(`icon-button`, styles.iconButton, className)} onClick={onClick}>
      <Icon {...props} />
    </div>
  );
}

export default IconButton;

IconButton.propTypes = {
  className: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  title: PropTypes.string,
  type: PropTypes.string.isRequired
};
