import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

function ListSeparator(props) {
  const mainStyles = [`separator`, styles.separator];
  const textStyles = [`separator-text`, styles.separatorText];
  const informativeClass = `informative`;
  if (props.isInformative) {
    mainStyles.push(informativeClass);
    mainStyles.push(styles[informativeClass]);
    textStyles.push(informativeClass);
    textStyles.push(styles[informativeClass]);
  }
  return (
    <div className={classNames(mainStyles)}>
      <p className={classNames(textStyles)}>{props.primaryText}</p>
    </div>
  );
}

ListSeparator.propTypes = {
  isInformative: PropTypes.bool,
  primaryText: PropTypes.object
};

export default ListSeparator;
