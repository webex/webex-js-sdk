import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

function Avatar({name, image, isSelfAvatar}) {
  let avatarClass, avatarStyle, backgroundStyle;
  const userInitial = name.substr(0, 1).toUpperCase();

  if (isSelfAvatar) {
    avatarStyle = styles.selfAvatar;
  }
  else if (image) {
    backgroundStyle = {backgroundImage: `url('${image}')`};
  }

  return (
    <div className={classNames(`avatar`, styles.avatar, avatarClass, avatarStyle)} style={backgroundStyle}>
      <span className={styles.avatarLetter}>
        {userInitial}
      </span>
    </div>
  );
}

Avatar.propTypes = {
  image: PropTypes.string,
  isSelfAvatar: PropTypes.bool,
  name: PropTypes.string.isRequired
};

export default Avatar;
