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
    return nextProps.sparkState.connected !== props.sparkState.connected || nextProps.user !== props.user || nextProps.conversation.activities !== props.conversation.activities || nextProps.widget !== props.widget || nextProps.indicators !== props.indicators || nextProps.conversation.isLoadingHistoryUp !== props.conversation.isLoadingHistoryUp;
  }

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

    props.setScrollPosition({scrollTop: this.activityList.getScrollTop()});

    if (this.activityList.isScrolledToBottom()) {
      props.showScrollToBottomButton(false);
      props.updateHasNewMessage(false);
    }
    else if (!widget.showScrollToBottomButton) {
      props.showScrollToBottomButton(true);
    }
    if (this.activityList.isScrolledToTop() && conversation.activities[0].verb !== `create`) {
      props.loadPreviousMessages(conversation.id, _.first(conversation.activities), spark);
    }
  }

  handleScrollToBottom() {
    this.activityList.scrollToBottom();
  }

  handleSubmit() {
    this.activityList.scrollToBottom();
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
      indicators,
      spark,
      sparkState,
      widget
    } = props;

    let currentUser;
    if (props.user) {
      currentUser = props.user.currentUser;
    }

    let main = ( // eslint-disable-line no-extra-parens
      <div className={classNames(`loading`, styles.loading)}>
        Connecting...
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
        const user = this.getUserFromConversation(conversation);
        const isTyping = indicators.typing.length > 0;
        const {displayName} = user;
        const messagePlaceholder = `Send a message to ${displayName}`;
        main = ( // eslint-disable-line no-extra-parens
          <div className={classNames(`widget-chat-inner`, styles.widgetChatInner)}>
            <div className={classNames(`title-bar-wrapper`, styles.titleBarWrapper)}>
              <TitleBar connectionStatus={sparkState} displayName={displayName} />
            </div>
            <div className={classNames(`activity-list-wrapper`, styles.activityListWrapper)}>
              <ScrollingActivity
                activities={activities}
                currentUserId={currentUser.id}
                isLoadingHistoryUp={isLoadingHistoryUp}
                isTyping={isTyping}
                onActivityDelete={this.handleActivityDelete}
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
  deleteActivity: PropTypes.func.isRequired,
  deleteActivityAndDismiss: PropTypes.func.isRequired,
  fetchCurrentUser: PropTypes.func.isRequired,
  hideDeleteModal: PropTypes.func.isRequired,
  listenToMercuryActivity: PropTypes.func.isRequired,
  loadPreviousMessages: PropTypes.func.isRequired,
  setScrollPosition: PropTypes.func.isRequired,
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
    widget: state.widget,
    indicators: state.indicators
  };
}

export default connect(
  mapStateToProps,
  (dispatch) => bindActionCreators({
    confirmDeleteActivity,
    createConversationWithUser,
    deleteActivity,
    deleteActivityAndDismiss,
    fetchCurrentUser,
    hideDeleteModal,
    listenToMercuryActivity,
    loadPreviousMessages,
    setScrollPosition,
    showScrollToBottomButton,
    updateHasNewMessage
  }, dispatch)
)(injectSpark(ChatWidget));
