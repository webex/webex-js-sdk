import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';

import ConnectionStatus from '../../components/connection-status';
import {fetchCurrentUser} from '../../actions/user';
import {createConversationWithUser} from '../../actions/conversation';
import TitleBar from '../../components/title-bar';
import ActivityList from '../../components/activity-list';
import MessageComposer from '../../components/message-composer';

import styles from './styles.css';

import injectSpark from '../../modules/redux-spark/inject-spark';

/**
 * ChatWidget Component
 *
 * @export
 * @class ChatWidget
 * @extends {React.Component}
 */
export class ChatWidget extends Component {

  componentWillReceiveProps(nextProps) {
    const {
      user,
      userId,
      spark,
      conversation
    } = nextProps;

    const {
      authenticated,
      connected,
      registered
    } = nextProps.sparkState;

    if (spark && connected && authenticated && registered) {
      if (!user.currentUser && !user.isFetching) {
        nextProps.fetchCurrentUser(spark);
      }
      if (!conversation.id && !conversation.isFetching) {
        nextProps.createConversationWithUser(userId, spark);
      }
    }

  }

  shouldComponentUpdate(nextProps) {
    const props = this.props;
    return nextProps.sparkState.connected !== props.sparkState.connected || nextProps.user !== props.user || nextProps.conversation !== props.conversation;
  }

  /**
   * Gets the non-current user of a conversation
   *
   * @param {object} conversation
   * @returns {object}
   */
  getUserFromConversation(conversation) {
    if (!conversation.participants) {
      return null;
    }
    const props = this.props;
    return conversation.participants.find((user) =>
      user.emailAddress === props.userId
    );
  }

  /**
   * Render
   *
   * @returns {Object}
   *
   * @memberOf ChatWidget
   */
  render() {
    const props = this.props;
    const {
      conversation,
      sparkState
    } = props;
    const {
      activities,
      id,
      participants
    } = conversation;

    let main = ( // eslint-disable-line no-extra-parens
      <div className="loading">
        Connecting...
      </div>
    );
    if (props.conversation.isLoaded) {
      const user = this.getUserFromConversation(props.conversation);
      const {displayName} = user;
      main = ( // eslint-disable-line no-extra-parens
        <div>
          <TitleBar displayName={displayName} />
          <ActivityList activities={activities} id={id} participants={participants} />
          <MessageComposer />
          <ConnectionStatus id="connection-status" {...sparkState} />
        </div>
      );
    }
    return (
      <div className={classNames(`widget-chat`, styles.widgetChat)}>
        {main}
      </div>
    );
  }
}

ChatWidget.propTypes = {
  createConversationWithUser: PropTypes.func.isRequired,
  fetchCurrentUser: PropTypes.func.isRequired,
  spark: PropTypes.object.isRequired,
  userId: PropTypes.string.isRequired
};

function mapStateToProps(state, ownProps) {
  return {
    spark: ownProps.spark,
    sparkState: state.spark,
    user: state.user,
    conversation: state.conversation
  };
}

export default connect(
  mapStateToProps,
  (dispatch) => bindActionCreators({
    createConversationWithUser,
    fetchCurrentUser
  }, dispatch)
)(injectSpark(ChatWidget));
