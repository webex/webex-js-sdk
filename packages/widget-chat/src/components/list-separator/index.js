import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

function ListSeparator(props) {
  const mainStyles = [`separator`, styles.separator];
  const textStyles = [`separator-text`, styles.separatorText];
  if (props.classNames) {
    props.classNames.forEach((className) => {
      mainStyles.push(className);
      mainStyles.push(styles[className]);
      textStyles.push(className);
      textStyles.push(styles[className]);
    });
  }
  return (
    <div className={classNames(mainStyles)}>
      <p className={classNames(textStyles)}>{props.primaryText}</p>
    </div>
  );
}

ListSeparator.propTypes = {
  classNames: PropTypes.array,
  primaryText: PropTypes.object
};

export default ListSeparator;
