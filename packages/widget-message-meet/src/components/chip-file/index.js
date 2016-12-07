import React, {PropTypes} from 'react';
import classNames from 'classnames';

import Icon, {ICON_TYPE_DOCUMENT} from '../icon';
import ChipBase from '../chip-base';
import styles from './styles.css';


export default function ChipFile(props) {
  const {
    name,
    size,
    thumbnail,
    type
  } = props;


  return (
    <ChipBase {...props}>
      <div className={classNames(`file-thumbnail`, styles.thumbnail)}>
        <div className={classNames(`file-icon`, styles.icon)}>
          <Icon type={ICON_TYPE_DOCUMENT} />
        </div>
        <img role="presentation" src={thumbnail} />
      </div>
      <div className={classNames(`file-info`, styles.info)}>
        <div className={classNames(`file-name`, styles.name)}>{name}</div>
        <div className={classNames(`file-meta`, styles.meta)}>
          <div className={classNames(`file-size`, styles.size)}>{size}</div>
          <div className={classNames(`file-type`, styles.type)}>{type}</div>
        </div>
      </div>
    </ChipBase>
  );
}

ChipFile.propTypes = {
  name: PropTypes.string,
  size: PropTypes.string,
  thumbnail: PropTypes.string,
  type: PropTypes.string
};
