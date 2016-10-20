import React, {PropTypes} from 'react';

import classNames from 'classnames';

function TypingIndicator(props) {
  let indicator;
  if (props.isTyping) {
    indicator = `...`;
  }
  return (
    <div className={classNames(`typing-indicator`)}>
      {indicator}
    </div>
  );
}

TypingIndicator.propTypes = {
  isTyping: PropTypes.bool
};

export default TypingIndicator;
