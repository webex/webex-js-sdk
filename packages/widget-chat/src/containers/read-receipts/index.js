import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';

import {getMostRecentReadReceipts} from '../../selectors/conversation';

import Avatar from '../../components/avatar';

class ReadReceipts extends Component {
  shouldComponentUpdate(nextProps) {
    const {props} = this;
    return nextProps.recent !== props.recent;
  }

  componentDidUpdate() {
    return false;
  }

  render() {
    const {props} = this;
    const {avatars, currentUser} = props.user;
    const users = props.readUsers
      .filter((user) => user.id !== currentUser.id)
      .map((user) => {
        const {displayName} = user;
        const image = avatars[user.id];
        return <Avatar image={image} key={user.id} name={displayName} />;
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
    user: state.user,
    readUsers: getMostRecentReadReceipts(state)
  };
}

ReadReceipts.propTypes = {
  readUsers: PropTypes.object,
  user: PropTypes.object
};

export default connect(
  mapStateToProps
)(ReadReceipts);
