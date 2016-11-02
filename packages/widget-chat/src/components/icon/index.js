import React, {PropTypes} from 'react';

import classNames from 'classnames';

import styles from './styles.css';

export const ICON_TYPE_ADD = `icon-cisco-add`;
export const ICON_TYPE_DELETE = `icon-cisco-exit-outline`;
export const ICON_TYPE_DOCUMENT = `icon-cisco-document-outline`;
export const ICON_TYPE_DOWNLOAD = `icon-cisco-download`;
export const ICON_TYPE_FLAGGED = `icon-cisco-flagged`;
export const ICON_TYPE_FLAGGED_OUTLINE = `icon-cisco-flagged-outline`;
export const ICON_TYPE_MESSAGE = `icon-cisco-message`;
export const ICON_TYPE_RIGHT_ARROW = `icon-cisco-right-arrow`;

function Icon(props) {
  return (
    <div className={classNames(`icon`, styles.icon, styles[props.type])} title={props.title} />
  );
}

Icon.propTypes = {
  title: PropTypes.string,
  type: PropTypes.string.isRequired
};

export default Icon;
