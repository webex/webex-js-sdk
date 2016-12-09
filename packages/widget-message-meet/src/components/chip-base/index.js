import React, {PropTypes} from 'react';
import classNames from 'classnames';

import {ICON_TYPE_DELETE} from '../icon';
import Button from '../button';
import styles from './styles.css';


export default function ChipBase(props) {
  const {
    children,
    id,
    onRemove
  } = props;

  function handleRemove() {
    onRemove(id);
  }

  return (
    <div className={classNames(`chip`, styles.chip)}>
      {children}
      <div className={classNames(`chip-action`, styles.action)}>
        <Button iconType={ICON_TYPE_DELETE} onClick={handleRemove} />
      </div>
    </div>
  );
}

ChipBase.propTypes = {
  children: PropTypes.node.isRequired,
  id: PropTypes.string,
  onRemove: PropTypes.func
};
