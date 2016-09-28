import React, {Component, PropTypes} from 'react';
import Avatar from '../avatar';

class ActivityReadReceipt extends Component {
  componentDidUpdate() {
    return false;
  }
  
  render() {
    const avatars = this.props.actors.map((actor) => <Avatar key={actor.userId} user={actor} />);
    return (
      <div>
        {avatars}
      </div>
    );
  }
}

ActivityReadReceipt.propTypes = {
  actors: PropTypes.object
};

export default ActivityReadReceipt;
