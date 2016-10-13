import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

export default function ScrollToBottomButton(props) {
  const {
    onClick,
    isHidden,
    text
  } = props;

  const hiddenStyle = isHidden ? styles.hidden : ``;
  const buttonStyle = text ? styles.withText : ``;
  return (
    <div className={classNames(`scroll-to-bottom-container`, styles.container, hiddenStyle)} onClick={onClick} >
      <button className={classNames(`scroll-to-bottom-button`, styles.button, buttonStyle)}>
        <span className={classNames(`scroll-to-bottom-text`, styles.text)}>{text}</span>
        <span className={classNames(`scroll-to-bottom-icon`, styles.icon)} />
      </button>
    </div>
  );
}

ScrollToBottomButton.propTypes = {
  isHidden: PropTypes.bool,
  onClick: PropTypes.func,
  text: PropTypes.string
};
