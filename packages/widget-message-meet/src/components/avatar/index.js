import React, {PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

function Avatar({name, image, isSelfAvatar}) {
  let avatarContents, backgroundStyle;


  if (isSelfAvatar) {
    avatarContents = <span className={classNames(`avatar-self`, styles.avatarSelf)} />;
  }
  else if (image) {
    backgroundStyle = {backgroundImage: `url('${image}')`};
  }
  else {
    avatarContents = <span className={classNames(`avatar-letter`, styles.avatarLetter)}>{name.substr(0, 1).toUpperCase()}</span>;
  }

  return (
    <div className={classNames(`avatar`, styles.avatar)} style={backgroundStyle}>
      {avatarContents}
    </div>
  );
}

Avatar.propTypes = {
  image: PropTypes.string,
  isSelfAvatar: PropTypes.bool,
  name: PropTypes.string.isRequired
};

export default Avatar;
