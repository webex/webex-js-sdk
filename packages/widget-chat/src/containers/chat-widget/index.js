import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';

import ConnectionStatus from '../../components/connection-status';
import {fetchCurrentUser} from '../../actions/user';
import {createConversationWithUser, listenToMercuryActivity} from '../../actions/conversation';
import TitleBar from '../../components/title-bar';
import ActivityList from '../../components/activity-list';
import MessageComposer from '../message-composer';

import styles from './styles.css';

import injectSpark from '../../modules/redux-spark/inject-spark';

/**
 * ChatWidget Component
 */
export class ChatWidget extends Component {

  constructor(props) {
    super(props);
    this.setActivityList = this.setActivityList.bind(this);
  }

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
      if (!user.currentUser && !user.isFetchingCurrentUser) {
        nextProps.fetchCurrentUser(spark);
      }
      if (!conversation.id && !conversation.isFetching) {
        nextProps.createConversationWithUser(userId, spark);
      }
    }

    if (conversation.id && !conversation.mercuryState.isListening) {
      nextProps.listenToMercuryActivity(conversation.id, spark);
    }
  }

  shouldComponentUpdate(nextProps) {
    const props = this.props;
    return nextProps.sparkState.connected !== props.sparkState.connected || nextProps.user !== props.user || nextProps.conversation !== props.conversation;
  }

  componentDidUpdate(props, state) {
    this.scrollToBottom();
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

  scrollToBottom() {
    if (this.activityList) {
      const node = this.activityList.getDOMNode();
      node.scrollTop = node.scrollHeight;
    }
  }

  setActivityList(ref) {
    this.activityList = ref;
  }

  /**
   * Render
   *
   * @returns {Object}
   */
  render() {
    const props = this.props;
    const {
      conversation,
      spark,
      sparkState
    } = props;

    let main = <div className="loading">Connecting...</div>;

    if (conversation) {
      const {
        activities,
        id,
        isLoaded,
        participants
      } = conversation;

      if (isLoaded) {
        const user = this.getUserFromConversation(conversation);
        const {displayName} = user;
        const messagePlaceholder = `Send a message to ${displayName}`;
        main = ( // eslint-disable-line no-extra-parens
          <div className={classNames(`widget-chat-inner`, styles.widgetChatInner)}>
            <div className={classNames(`title-bar-wrapper`, styles.titleBarWrapper)}>
              <TitleBar displayName={displayName} />
              <ConnectionStatus id="connection-status" {...sparkState} />
            </div>
            <div className={classNames(`activity-list-wrapper`, styles.activityListWrapper)}>
              <ActivityList
                activities={activities}
                id={id}
                participants={participants}
              />
            </div>
            <div className={classNames(`message-composer-wrapper`, styles.messageComposerWrapper)}>
              <MessageComposer conversation={conversation} placeholder={messagePlaceholder} spark={spark} />
            </div>
          </div>
        );
      }
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
  listenToMercuryActivity: PropTypes.func.isRequired,
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
    fetchCurrentUser,
    listenToMercuryActivity
  }, dispatch)
)(injectSpark(ChatWidget));
