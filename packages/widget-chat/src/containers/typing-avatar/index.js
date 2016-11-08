import React, {PropTypes} from 'react';

import Avatar from '../../components/avatar';
import TypingIndicator from '../../components/typing-indicator';

import classNames from 'classnames';

import styles from './styles.css';

function TypingAvatar(props) {
  const {image, isTyping, name} = props;
  let typingIndicator;
  if (isTyping) {
    typingIndicator = <TypingIndicator />;
  }
  return (
    <div className={classNames(`typing-avatar`, styles.typingAvatar)}>
      <div className={classNames(`avatar`, styles.avatar)}>
        <Avatar image={image} name={name} />
      </div>
      <div className={classNames(`typing`, styles.typing)}>
        {typingIndicator}
      </div>
    </div>
  );
}

TypingAvatar.propTypes = {
  image: PropTypes.string,
  isTyping: PropTypes.bool,
  name: PropTypes.string.isRequired
};

export default TypingAvatar;
