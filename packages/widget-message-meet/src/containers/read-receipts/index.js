import React, {Component} from 'react';
import {connect} from 'react-redux';

import {getMostRecentReadReceipts} from '../../selectors/conversation';

import TypingAvatar from '../../components/typing-avatar';

class ReadReceipts extends Component {
  shouldComponentUpdate(nextProps) {
    const {props} = this;
    return nextProps.readUsers !== props.readUsers || nextProps.user !== props.user || nextProps.typing !== props.typing;
  }

  componentDidUpdate() {
    return false;
  }

  render() {
    const stateProps = this.props;
    const {avatars, currentUser} = stateProps.user;
    const typing = stateProps.typing;
    const users = stateProps.readUsers
      .filter((user) => user.id !== currentUser.id)
      .map((user) => {
        const {displayName} = user;
        const image = avatars[user.id];
        // Typing events don't give us user IDs, only emails.
        const isTyping = typing.includes(user.emailAddress);
        /* eslint-disable-reason React.*/
        /* eslint-disable no-extra-parens */
        return (
          <TypingAvatar
            image={image}
            isTyping={isTyping}
            key={user.id}
            name={displayName}
          />
        );
        /* eslint-enable no-extra-parens */
      });

    return (
      <div>
        {users}
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    typing: state.indicators.typing,
    user: state.user,
    readUsers: getMostRecentReadReceipts(state)
  };
}

export default connect(
  mapStateToProps
)(ReadReceipts);
