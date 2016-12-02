import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Icon from '../icon';

import styles from './styles.css';

export default function Button(props) {
  const {
    buttonClassName,
    label,
    onClick,
    title,
    iconType
  } = props;

  let icon;

  if (iconType) {
    icon = <Icon title={title} type={iconType} />;
  }

  return (
    <button className={classNames(`button`, styles.button, buttonClassName)} onClick={onClick} onKeyUp={onClick}>
      {icon}
      {label}
    </button>
  );
}

Button.propTypes = {
  buttonClassName: PropTypes.string,
  iconType: PropTypes.string,
  label: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  title: PropTypes.string
};
