import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Icon from '../icon';

import styles from './styles.css';

function IconButton(props) {
  const {onClick} = props;
  return (
    <div className={classNames(`icon-button`, styles.iconButton)} onClick={onClick}>
      <Icon {...props} />
    </div>
  );
}

export default IconButton;

IconButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  title: PropTypes.string,
  type: PropTypes.string.isRequired
};
