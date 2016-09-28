import React, {Component, PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

class MessageComposer extends Component {
  shouldComponentUpdate() {
    return false;
  }

  render() {
    return (
      <div className={classNames(`message-composer`, styles.messageComposer)}>
        MessageComposer
      </div>
    );
  }
}

MessageComposer.propTypes = {

};

export default MessageComposer;
