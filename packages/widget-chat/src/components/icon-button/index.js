import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Icon from '../icon';

import styles from './styles.css';

function IconButton(props) {
  const {
    buttonClassName,
    onClick,
    title,
    type
  } = props;

  return (
    <button className={classNames(`icon-button`, styles.iconButton, buttonClassName)} onClick={onClick} onKeyUp={onClick}>
      <Icon title={title} type={type} />
    </button>
  );
}

export default IconButton;

IconButton.propTypes = {
  buttonClassName: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  title: PropTypes.string,
  type: PropTypes.string.isRequired
};
