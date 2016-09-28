import React, {Component, PropTypes} from 'react';

class MessageComposer extends Component {
  shouldComponentUpdate() {
    return false;
  }

  render() {
    return (
      <div>
        MessageComposer
      </div>
    );
  }
}

MessageComposer.propTypes = {

};

export default MessageComposer;
