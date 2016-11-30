import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

function ListSeparator(props) {
  return (
    <div className={classNames(`separator`, styles.separator)}>
      <p className={classNames(`separator-text`, styles.separatorText)}>{props.primaryText}</p>
    </div>
  );
}

ListSeparator.propTypes = {
  primaryText: PropTypes.object
};

export default ListSeparator;
