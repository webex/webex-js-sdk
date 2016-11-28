import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

export default function TextArea(props) {
  const {
    textAreaClassName,
    onChange,
    onKeyDown,
    onSubmit,
    placeholder,
    rows,
    value
  } = props;

  return (
    <textarea
      className={classNames(`textarea`, styles.textarea, textAreaClassName)}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onSubmit={onSubmit}
      placeholder={placeholder}
      rows={rows}
      value={value}
    />
  );
}

TextArea.propTypes = {
  onChange: PropTypes.func,
  onKeyDown: PropTypes.func,
  onSubmit: PropTypes.func,
  placeholder: PropTypes.string,
  rows: PropTypes.number,
  textAreaClassName: PropTypes.string,
  value: PropTypes.string
};
