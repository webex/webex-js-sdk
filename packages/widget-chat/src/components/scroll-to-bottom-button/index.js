import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

export default function ScrollToBottomButton(props) {
  const {
    onClick,
    label
  } = props;

  let containerStyle, labelSpan;

  if (label) {
    labelSpan = <span className={classNames(`scroll-to-bottom-label`, styles.label)}>{label}</span>;
    containerStyle = styles.withText;
  }

  return (
    <div className={classNames(`scroll-to-bottom-container`, styles.container, containerStyle)} onClick={onClick} >
      <button className={classNames(`scroll-to-bottom-button`, styles.button)}>
        {labelSpan}
        <span className={classNames(`scroll-to-bottom-icon`, styles.icon)} />
      </button>
    </div>
  );
}

ScrollToBottomButton.propTypes = {
  label: PropTypes.string,
  onClick: PropTypes.func
};
