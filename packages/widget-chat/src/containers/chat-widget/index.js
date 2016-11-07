import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';
import _ from 'lodash';

import {
  fetchAvatarForUserId,
  fetchCurrentUser
} from '../../actions/user';
import {
  createConversationWithUser,
  listenToMercuryActivity,
  loadPreviousMessages
} from '../../actions/conversation';
import {
  fetchFlags,
  flagActivity,
  removeFlagFromServer
} from '../../actions/flags';
import {
  confirmDeleteActivity,
  deleteActivityAndDismiss,
  hideDeleteModal,
  setScrollPosition,
  showScrollToBottomButton,
  updateHasNewMessage
} from '../../actions/widget';
import TitleBar from '../../components/title-bar';
import ScrollingActivity from '../scrolling-activity';
import ScrollToBottomButton from '../../components/scroll-to-bottom-button';
import Spinner from '../../components/spinner';
import MessageComposer from '../message-composer';

import styles from './styles.css';

import injectSpark from '../../modules/redux-spark/inject-spark';

import ConfirmationModal from '../../components/confirmation-modal';

/**
 * ChatWidget Component
 */
export class ChatWidget extends Component {
  constructor(props) {
    super(props);
    this.getActivityList = this.getActivityList.bind(this);
    this.handleActivityDelete = this.handleActivityDelete.bind(this);
    this.handleCancelActivityDelete = this.handleCancelActivityDelete.bind(this);
    this.handleConfirmActivityDelete = this.handleConfirmActivityDelete.bind(this);
    this.handleActivityFlag = this.handleActivityFlag.bind(this);
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
        this.props.fetchCurrentUser(spark);
      }
      if (!conversation.id && !conversation.isFetching) {
        this.props.createConversationWithUser(userId, spark);
      }
    }

    // Setup once we have a conversation
    if (conversation.id) {
      this.setupConversationActions(conversation, nextProps);
    }
  }

  /* eslint-disable complexity */
  /* eslint-disable-reason: Lots of checks for better efficiency, will be broken up later */
  shouldComponentUpdate(nextProps) {
    const props = this.props;

    /* eslint-disable operator-linebreak */
    /* eslint-disable-reason: Giant list of comparisons very difficult to read and diff */
    return nextProps.conversation.activities !== props.conversation.activities
      || nextProps.conversation.isLoadingHistoryUp !== props.conversation.isLoadingHistoryUp
      || nextProps.flags !== props.flags
      || nextProps.indicators !== props.indicators
      || nextProps.share !== props.share
      || nextProps.sparkState.connected !== props.sparkState.connected
      || nextProps.user !== props.user
      || nextProps.widget !== props.widget;
    /* eslint-enable operator-linebreak */
  }
  /* eslint-enable complexity */

  componentWillUpdate(nextProps) {
    const props = this.props;
    if (this.activityList && nextProps.conversation.activities.length !== props.conversation.activities.length) {
      this.scrollHeight = this.activityList.getScrollHeight();
    }
  }

  componentDidUpdate(prevProps) {
    const props = this.props;
    const activityList = this.activityList;

    if (activityList) {
      const lastActivityFromPrev = _.last(prevProps.conversation.activities);
      const lastActivityFromThis = _.last(props.conversation.activities);

      const firstActivityFromPrev = _.first(prevProps.conversation.activities);
      const firstActivityFromThis = _.first(props.conversation.activities);

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
      else if (firstActivityFromThis.id !== firstActivityFromPrev.id) {
        activityList.setScrollTop(activityList.getScrollHeight() - this.scrollHeight + prevProps.widget.scrollTop);
      }
    }
  }

  /**
   * Once a conversation has been established, setup
   * actions need to happen for app state
   *
   * @param {any} conversation
   * @param {any} nextProps
   *
   * @returns {null}
   */
  setupConversationActions(conversation, nextProps) {
    const {flags, spark} = nextProps;
    const {props} = this;
    const prevConversation = props.conversation;
    if (!conversation.mercuryState.isListening) {
      this.props.listenToMercuryActivity(conversation.id, spark);
    }
    if (!flags.hasFetched && !flags.isFetching) {
      nextProps.fetchFlags(spark);
    }
    // We only want to fetch avatars when a new activity is seen
    if (conversation.participants.length && conversation.participants.length !== prevConversation.participants.length) {
      this.getAvatarsFromConversation(conversation);
    }
  }

  /**
   * Processes the activities and fetches avatars for users
   * that have not been fetched yet
   *
   * @param {any} conversation
   *
   * @returns {null}
   */
  getAvatarsFromConversation(conversation) {
    const {props} = this;
    const {
      spark,
      user
    } = props;
    const {participants} = conversation;
    const userIds = _.uniq(participants.map((participant) => participant.id))
      .filter((userId) => {
        // Only return users that haven't been fetched or is fetching
        const fetched = user.avatars.hasOwnProperty(userId);
        const fetching = user.avatarsInFlight.indexOf(userId) !== -1;
        return !fetched || !fetching;
      });
    userIds.forEach((userId) => this.props.fetchAvatarForUserId(userId, spark));
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
      spark,
      widget
    } = props;

    this.props.setScrollPosition({scrollTop: this.activityList.getScrollTop()});

    if (this.activityList.isScrolledToBottom()) {
      this.props.showScrollToBottomButton(false);
      this.props.updateHasNewMessage(false);
    }
    else if (!widget.showScrollToBottomButton) {
      this.props.showScrollToBottomButton(true);
    }
    if (this.activityList.isScrolledToTop() && conversation.activities[0].verb !== `create`) {
      this.props.loadPreviousMessages(conversation.id, _.first(conversation.activities), spark);
    }
  }

  handleScrollToBottom() {
    this.activityList.scrollToBottom();
  }

  handleSubmit() {
    this.activityList.scrollToBottom();
  }

  handleActivityFlag(activityId) {
    const props = this.props;
    const {
      conversation,
      flags,
      spark
    } = props;
    const activity = conversation.activities.find((act) => act.id === activityId);
    if (activity) {
      const foundFlag = flags.flags.find((flag) => flag.activityUrl === activity.url);
      if (foundFlag) {
        this.props.removeFlagFromServer(foundFlag, spark);
      }
      else {
        this.props.flagActivity(activity, spark);
      }

    }
  }

  /**
   * Displays modal confirming activity delete
   *
   * @param {String} activityId
   *
   * @returns {undefined}
   */
  handleActivityDelete(activityId) {
    this.props.confirmDeleteActivity(activityId);
  }

  /**
   * Does the actual deletion of the activity after confirmation modal
   *
   * @returns {undefined}
   */
  handleConfirmActivityDelete() {
    const props = this.props;
    const {
      conversation,
      spark,
      widget
    } = props;
    const activityId = widget.deletingActivityId;
    const activity = conversation.activities.find((act) => act.id === activityId);
    if (activity) {
      this.props.deleteActivityAndDismiss(conversation, activity, spark);
    }
    else {
      this.props.hideDeleteModal();
    }
  }

  /**
   * Dismisses the confirmation modal
   *
   * @returns {undefined}
   */
  handleCancelActivityDelete() {
    this.props.hideDeleteModal();
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
      flags,
      indicators,
      spark,
      sparkState,
      user,
      widget
    } = props;

    const {
      avatars,
      currentUser
    } = user;

    let main = ( // eslint-disable-line no-extra-parens
      <div className={classNames(`loading`, styles.loading)}>
        {`Connecting...`}
        <div className={classNames(`spinner-container`, styles.spinnerContainer)}>
          <Spinner />
        </div>
      </div>
    );

    if (conversation) {
      const {
        activities,
        isLoaded,
        isLoadingHistoryUp
      } = conversation;

      let scrollButton;
      if (props.widget.showScrollToBottomButton) {
        const label = widget.hasNewMessage ? `New Messages` : null;
        scrollButton = <ScrollToBottomButton label={label} onClick={this.handleScrollToBottom} />;
      }

      let deleteAlert;
      if (props.widget.showAlertModal) {
        const alertMessages = {
          title: `Delete`,
          body: `Are you sure you want to delete this message?`,
          actionButtonText: `Delete`,
          cancelButtonText: `Cancel`
        };
        deleteAlert = ( // eslint-disable-line no-extra-parens
          <ConfirmationModal
            messages={alertMessages}
            onClickActionButton={this.handleConfirmActivityDelete}
            onClickCancelButton={this.handleCancelActivityDelete}
          />
        );
      }

      if (isLoaded) {
        const toUser = this.getUserFromConversation(conversation);
        const toUserAvatar = avatars[toUser.id];
        const isTyping = indicators.typing.length > 0;
        const {displayName} = toUser;
        const messagePlaceholder = `Send a message to ${displayName}`;
        main = ( // eslint-disable-line no-extra-parens
          <div className={classNames(`widget-chat-inner`, styles.widgetChatInner)}>
            <div className={classNames(`title-bar-wrapper`, styles.titleBarWrapper)}>
              <TitleBar
                connectionStatus={sparkState}
                displayName={displayName}
                image={toUserAvatar}
              />
            </div>
            <div className={classNames(`activity-list-wrapper`, styles.activityListWrapper)}>
              <ScrollingActivity
                activities={activities}
                avatars={avatars}
                currentUserId={currentUser.id}
                flags={flags.flags}
                isLoadingHistoryUp={isLoadingHistoryUp}
                isTyping={isTyping}
                onActivityDelete={this.handleActivityDelete}
                onActivityFlag={this.handleActivityFlag}
                onScroll={this.handleScroll}
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
            {deleteAlert}
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
  confirmDeleteActivity: PropTypes.func.isRequired,
  createConversationWithUser: PropTypes.func.isRequired,
  deleteActivityAndDismiss: PropTypes.func.isRequired,
  fetchAvatarForUserId: PropTypes.func.isRequired,
  fetchCurrentUser: PropTypes.func.isRequired,
  flagActivity: PropTypes.func.isRequired,
  hideDeleteModal: PropTypes.func.isRequired,
  listenToMercuryActivity: PropTypes.func.isRequired,
  loadPreviousMessages: PropTypes.func.isRequired,
  removeFlagFromServer: PropTypes.func.isRequired,
  setScrollPosition: PropTypes.func.isRequired,
  showScrollToBottomButton: PropTypes.func.isRequired,
  spark: PropTypes.object.isRequired,
  updateHasNewMessage: PropTypes.func.isRequired,
  userId: PropTypes.string.isRequired
};

function mapStateToProps(state, ownProps) {
  return {
    share: state.share,
    spark: ownProps.spark,
    sparkState: state.spark,
    flags: state.flags,
    user: state.user,
    conversation: state.conversation,
    widget: state.widget,
    indicators: state.indicators
  };
}

export default connect(
  mapStateToProps,
  (dispatch) => bindActionCreators({
    confirmDeleteActivity,
    createConversationWithUser,
    deleteActivityAndDismiss,
    fetchAvatarForUserId,
    fetchCurrentUser,
    fetchFlags,
    flagActivity,
    hideDeleteModal,
    listenToMercuryActivity,
    loadPreviousMessages,
    removeFlagFromServer,
    setScrollPosition,
    showScrollToBottomButton,
    updateHasNewMessage
  }, dispatch)
)(injectSpark(ChatWidget));
