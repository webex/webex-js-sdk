import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

export default function ScrollToBottomButton(props) {
  const {
    onClick
  } = props;
  return (
    <div className={classNames(`scroll-to-bottom-container`, styles.container)} onClick={onClick} >
      <button className={classNames(`scroll-to-bottom-button`, styles.button)}>
        <span className={classNames(`scroll-to-bottom-icon`, styles.icon)} />
      </button>
    </div>
  );
}

ScrollToBottomButton.propTypes = {
  onClick: PropTypes.func
};
