import React, {PropTypes} from 'react';

import classNames from 'classnames';

import styles from './styles.css';

function Icon(props) {
  let iconCode = ``;
  if (props.type === `delete`) {
    iconCode = `\uE0E7`;
  }
  return (
    <div className={classNames(`icon-container`, styles.iconContainer)}>
      <div className={classNames(`icon`, props.type, styles.icon)} onClick={props.handleOnClick} title={props.title}>
        {iconCode}
      </div>
    </div>
  );
}

Icon.propTypes = {
  handleOnClick: PropTypes.func,
  title: PropTypes.string,
  type: PropTypes.string.isRequired
};

export default Icon;
