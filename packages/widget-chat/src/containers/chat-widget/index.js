import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';
import _ from 'lodash';

import ConnectionStatus from '../../components/connection-status';
import {fetchCurrentUser} from '../../actions/user';
import {
  createConversationWithUser,
  listenToMercuryActivity,
  updateShouldScroll
} from '../../actions/conversation';
import TitleBar from '../../components/title-bar';
import ActivityList from '../../components/activity-list';
import ScrollToBottomButton from '../../components/scroll-to-bottom-button';
import MessageComposer from '../message-composer';

import styles from './styles.css';

import injectSpark from '../../modules/redux-spark/inject-spark';

/**
 * ChatWidget Component
 */
export class ChatWidget extends Component {

  constructor(props) {
    super(props);
    this.getActivityList = this.getActivityList.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
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

    // check if new activity is users position
    // check if already at the bottom
  }

  shouldComponentUpdate(nextProps) {
    const props = this.props;
    return nextProps.sparkState.connected !== props.sparkState.connected || nextProps.user !== props.user || nextProps.conversation.activities !== props.conversation.activities;
  }

  componentDidUpdate(prevProps) {
    const props = this.props;
    const activityList = this.activityList;

    if (activityList) {
      const lastActivityFromPrev = _.last(prevProps.conversation.activities);
      const lastActivityFromThis = _.last(props.conversation.activities);

      // If new activity comes in
      if (lastActivityFromPrev && lastActivityFromThis && props.conversation.activities.length !== prevProps.conversation.activities.length && lastActivityFromPrev.id !== lastActivityFromThis.id) {
        // Scroll if from ourselves
        if (props.user.id === lastActivityFromThis.actor.id) {
          activityList.scrollToBottom();
        }
        else {
          // Scroll if already at the bottom
          if (activityList.isScrolledToBottom()) {
            activityList.scrollToBottom();
          }
          else {
            // Show new activity message
          }
        }
      }
      else if (prevProps.conversation.activities.length === 0) {
        activityList.scrollToBottom();
      }
    }
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

  getActivityList(ref) {
    this.activityList = ref;
  }

  handleScroll() {
    _.debounce(() => {
      console.log(this);
    }, 150, {
      leading: true,
      trailing: true
    });
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
                onScroll={this.handleScroll}
                participants={participants}
                ref={this.getActivityList}
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
  updateShouldScroll: PropTypes.func.isRequired,
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
    listenToMercuryActivity,
    updateShouldScroll
  }, dispatch)
)(injectSpark(ChatWidget));
