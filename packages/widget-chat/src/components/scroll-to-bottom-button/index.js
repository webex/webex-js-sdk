import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

export default function ScrollToBottomButton(props) {
  const {
    onClick,
    label
  } = props;

  const buttonStyle = label ? styles.withText : ``;
  return (
    <div className={classNames(`scroll-to-bottom-container`, styles.container)} onClick={onClick} >
      <button className={classNames(`scroll-to-bottom-button`, styles.button, buttonStyle)}>
        <span className={classNames(`scroll-to-bottom-label`, styles.text)}>{label}</span>
        <span className={classNames(`scroll-to-bottom-icon`, styles.icon)} />
      </button>
    </div>
  );
}

ScrollToBottomButton.propTypes = {
  label: PropTypes.string,
  onClick: PropTypes.func
};
