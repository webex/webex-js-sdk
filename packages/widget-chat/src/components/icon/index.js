import React, {PropTypes} from 'react';

import classNames from 'classnames';

import styles from './styles.css';

export const ICON_TYPE_ADD = `add`;
export const ICON_TYPE_DELETE = `delete`;
export const ICON_TYPE_MESSAGE = `message`;
export const ICON_TYPE_RIGHT_ARROW = `rightArrow`;

function Icon(props) {
  return (
    <div className={classNames(`icon`, styles[props.type])} title={props.title} />
  );
}

Icon.propTypes = {
  title: PropTypes.string,
  type: PropTypes.string.isRequired
};

export default Icon;
