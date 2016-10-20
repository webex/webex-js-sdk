import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';
import _ from 'lodash';

import {fetchCurrentUser} from '../../actions/user';
import {
  createConversationWithUser,
  deleteActivity,
  listenToMercuryActivity,
  loadPreviousMessages
} from '../../actions/conversation';
import {
  updateHasNewMessage,
  showScrollToBottomButton
} from '../../actions/widget';
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
    this.handleActivityDelete = this.handleActivityDelete.bind(this);
    this.handleScrollToBottom = this.handleScrollToBottom.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleScroll = _.debounce(this.handleScroll.bind(this), 150);
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
    return nextProps.sparkState.connected !== props.sparkState.connected || nextProps.user !== props.user || nextProps.conversation.activities !== props.conversation.activities || nextProps.widget !== props.widget;
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
        if (props.user.currentUser.id === lastActivityFromThis.actorId) {
          activityList.scrollToBottom();
        }
        else if (activityList.isScrolledToBottom()) {
          activityList.scrollToBottom();
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
    const props = this.props;
    const {
      conversation,
      spark
    } = props;
    if (this.activityList.isScrolledToBottom()) {
      props.showScrollToBottomButton(false);
      props.updateHasNewMessage(false);
    }
    else if (!props.widget.showScrollToBottomButton) {
      props.showScrollToBottomButton(true);
    }
    if (this.activityList.isScrolledToTop()) {
      props.loadPreviousMessages(conversation.id, _.first(conversation.activities), spark);
    }
  }

  handleScrollToBottom() {
    this.activityList.scrollToBottom();
  }

  handleSubmit() {
    this.activityList.scrollToBottom();
  }

  handleActivityDelete(activityId) {
    const props = this.props;
    const {
      conversation,
      spark
    } = props;
    const activity = conversation.activities.find((act) => act.id === activityId);
    if (activity) {
      this.props.deleteActivity(conversation, activity, spark);
    }
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
      sparkState,
      widget
    } = props;

    let currentUser;
    if (props.user) {
      currentUser = props.user.currentUser;
    }

    let main = <div className="loading">Connecting...</div>;

    if (conversation) {
      const {
        activities,
        id,
        isLoaded,
        participants
      } = conversation;

      let scrollButton;
      if (props.widget.showScrollToBottomButton) {
        const label = widget.hasNewMessage ? `New Messages` : null;
        scrollButton = <ScrollToBottomButton label={label} onClick={this.handleScrollToBottom} />;
      }

      if (isLoaded) {
        const user = this.getUserFromConversation(conversation);
        const {displayName} = user;
        const messagePlaceholder = `Send a message to ${displayName}`;
        main = ( // eslint-disable-line no-extra-parens
          <div className={classNames(`widget-chat-inner`, styles.widgetChatInner)}>
            <div className={classNames(`title-bar-wrapper`, styles.titleBarWrapper)}>
              <TitleBar connectionStatus={sparkState} displayName={displayName} />
            </div>
            <div className={classNames(`activity-list-wrapper`, styles.activityListWrapper)}>
              <ActivityList
                activities={activities}
                currentUserId={currentUser.id}
                id={id}
                onActivityDelete={this.handleActivityDelete}
                onScroll={this.handleScroll}
                participants={participants}
                ref={this.getActivityList}
              />
              {scrollButton}
            </div>
            <div className={classNames(`message-composer-wrapper`, styles.messageComposerWrapper)}>
              <MessageComposer
                conversation={conversation}
                onSubmit={this.handleSubmit}
                placeholder={messagePlaceholder}
                spark={spark}
              />
            </div>
          </div>
        );
      }
    }
    return (
      <div className={classNames(`widget-chat`, styles.widgetChat)}>
        <div className={classNames(`banner`, styles.banner)} />
        {main}
      </div>
    );
  }
}

ChatWidget.propTypes = {
  createConversationWithUser: PropTypes.func.isRequired,
  deleteActivity: PropTypes.func.isRequired,
  fetchCurrentUser: PropTypes.func.isRequired,
  listenToMercuryActivity: PropTypes.func.isRequired,
  loadPreviousMessages: PropTypes.func.isRequired,
  showScrollToBottomButton: PropTypes.func.isRequired,
  spark: PropTypes.object.isRequired,
  updateHasNewMessage: PropTypes.func.isRequired,
  userId: PropTypes.string.isRequired
};

function mapStateToProps(state, ownProps) {
  return {
    spark: ownProps.spark,
    sparkState: state.spark,
    user: state.user,
    conversation: state.conversation,
    widget: state.widget
  };
}

export default connect(
  mapStateToProps,
  (dispatch) => bindActionCreators({
    createConversationWithUser,
    deleteActivity,
    fetchCurrentUser,
    listenToMercuryActivity,
    loadPreviousMessages,
    showScrollToBottomButton,
    updateHasNewMessage
  }, dispatch)
)(injectSpark(ChatWidget));
