import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';
import _ from 'lodash';
import {injectIntl, intlShape, FormattedMessage} from 'react-intl';
import Dropzone from 'react-dropzone';

import {
  fetchAvatarForUserId,
  fetchCurrentUser
} from '../../actions/user';
import {
  acknowledgeActivityOnServer,
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
  NOTIFICATION_TYPE_POST,
  createNotification
} from '../../actions/notifications';
import {
  confirmDeleteActivity,
  deleteActivityAndDismiss,
  hideDeleteModal,
  setScrollPosition,
  showScrollToBottomButton,
  updateHasNewMessage
} from '../../actions/widget';
import {addFiles} from '../../actions/activity';
import {constructFiles} from '../../utils/files';
import TitleBar from '../../components/title-bar';
import ScrollingActivity from '../scrolling-activity';
import ScrollToBottomButton from '../../components/scroll-to-bottom-button';
import LoadingScreen from '../../components/loading-screen';
import MessageComposer from '../message-composer';
import Notifications from '../notifications';

import styles from './styles.css';

import injectSpark from '../../modules/redux-spark/inject-spark';

import ConfirmationModal from '../../components/confirmation-modal';

/**
 * MessageMeetWidget Component
 */
export class MessageMeetWidget extends Component {
  constructor(props) {
    super(props);
    this.getActivityList = this.getActivityList.bind(this);
    this.handleActivityDelete = this.handleActivityDelete.bind(this);
    this.handleCancelActivityDelete = this.handleCancelActivityDelete.bind(this);
    this.handleConfirmActivityDelete = this.handleConfirmActivityDelete.bind(this);
    this.handleActivityFlag = this.handleActivityFlag.bind(this);
    this.handleScrollToBottom = this.handleScrollToBottom.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleFileDrop = this.handleFileDrop.bind(this);
    this.handleScroll = _.debounce(this.handleScroll.bind(this), 150);
    this.renderConversation = this.renderConversation.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    const {
      user,
      toPersonEmail,
      toPersonId,
      spark,
      conversation
    } = nextProps;

    const {
      authenticated,
      connected,
      registered
    } = nextProps.sparkState;

    if (spark && connected && authenticated && registered) {
      if (!user.currentUser.id && !user.isFetchingCurrentUser) {
        nextProps.fetchCurrentUser(spark);
      }
      if (!conversation.id && !conversation.isFetching) {
        nextProps.createConversationWithUser(toPersonId || toPersonEmail, spark);
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
      || nextProps.activity.get(`inFlightActivities`) !== props.activity.get(`inFlightActivities`)
      || nextProps.conversation.isLoadingHistoryUp !== props.conversation.isLoadingHistoryUp
      || nextProps.flags !== props.flags
      || nextProps.indicators !== props.indicators
      || nextProps.share !== props.share
      || nextProps.sparkState.connected !== props.sparkState.connected
      || nextProps.user !== props.user
      || nextProps.widget !== props.widget
      || nextProps.activity.getIn([`status`, `isSending`]) !== props.activity.getIn([`status`, `isSending`]);
    /* eslint-enable operator-linebreak */
  }
  /* eslint-enable complexity */

  componentWillUpdate(nextProps) {
    const props = this.props;
    if (this.activityList && nextProps.conversation.activities.size !== props.conversation.activities.size) {
      this.scrollHeight = this.activityList.getScrollHeight();
    }
  }

  componentDidUpdate(prevProps) {
    const props = this.props;
    const activityList = this.activityList;
    if (activityList) {
      const lastActivityFromPrev = prevProps.conversation.activities.last();
      const lastActivityFromThis = props.conversation.activities.last();
      const firstActivityFromPrev = prevProps.conversation.activities.first();
      const firstActivityFromThis = props.conversation.activities.first();
      // If new activity comes in
      if (lastActivityFromPrev && lastActivityFromThis && props.conversation.activities.size !== prevProps.conversation.activities.size && lastActivityFromPrev.id !== lastActivityFromThis.id) {
        if (props.user.currentUser.id !== lastActivityFromThis.actor.id) {
          // Send notification of new message
          props.createNotification(lastActivityFromThis.url, NOTIFICATION_TYPE_POST);
        }
      }
      else if (firstActivityFromThis && firstActivityFromPrev && firstActivityFromThis.id !== firstActivityFromPrev.id) {
        activityList.setScrollTop(activityList.getScrollHeight() - this.scrollHeight + prevProps.widget.scrollTop);
      }
      // Scroll to bottom when needed
      if (this.shouldScrollToBottom(props, prevProps)) {
        activityList.scrollToBottom();
      }
    }
  }

  /**
   * Scrolls the window to the bottom when it should
   * (called from componentDidUpdate)
   *
   * @param {any} props
   * @param {any} prevProps
   * @returns {bool}
   *
   * @memberOf MessageMeetWidget
   */
  shouldScrollToBottom(props, prevProps) {
    let shouldScrollToBottom = false;
    const activityList = this.activityList;
    const lastActivityFromPrev = prevProps.conversation.activities.last();
    const lastActivityFromThis = props.conversation.activities.last();
    // If new activity comes in
    if (lastActivityFromPrev && lastActivityFromThis && props.conversation.activities.size !== prevProps.conversation.activities.size && lastActivityFromPrev.id !== lastActivityFromThis.id) {
      // Scroll if from ourselves
      if (props.user.currentUser.id === lastActivityFromThis.actor.id) {
        shouldScrollToBottom = true;
      }
      else if (activityList.isScrolledToBottom()) {
        shouldScrollToBottom = true;
      }
    }
    else if (prevProps.conversation.activities.size === 0) {
      shouldScrollToBottom = true;
    }
    // Scroll to show in flight activities
    if (props.activity.get(`inFlightActivities`).size && props.activity.get(`inFlightActivities`).size !== prevProps.activity.get(`inFlightActivities`).size) {
      shouldScrollToBottom = true;
    }

    return shouldScrollToBottom;
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
      props.listenToMercuryActivity(conversation.id, spark);
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
    userIds.forEach((userId) => props.fetchAvatarForUserId(userId, spark));
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
      user.id !== props.user.currentUser.id
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

    const lastActivity = conversation.activities.last();
    if (this.activityList.isScrolledToBottom()) {
      props.showScrollToBottomButton(false);
      props.updateHasNewMessage(false);
      if (conversation.lastAcknowledgedActivityId !== lastActivity.id) {
        props.acknowledgeActivityOnServer(conversation, lastActivity, spark);
      }
    }
    else if (!widget.showScrollToBottomButton) {
      props.showScrollToBottomButton(true);
    }

    if (this.activityList.isScrolledToTop() && conversation.activities.first().verb !== `create`) {
      props.loadPreviousMessages(conversation.id, conversation.activities.first(), spark);
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
        props.removeFlagFromServer(foundFlag, spark);
      }
      else {
        props.flagActivity(activity, spark);
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
    const props = this.props;
    props.confirmDeleteActivity(activityId);
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
      props.deleteActivityAndDismiss(conversation, activity, spark);
    }
    else {
      props.hideDeleteModal();
    }
  }

  /**
   * Dismisses the confirmation modal
   *
   * @returns {undefined}
   */
  handleCancelActivityDelete() {
    const props = this.props;
    props.hideDeleteModal();
  }

  /**
   * Adds dropped file into activity store
   *
   * @param {array} acceptedFiles
   *
   * @returns {undefined}
   */
  handleFileDrop(acceptedFiles) {
    const props = this.props;
    const {
      conversation,
      activity,
      spark
    } = props;
    const files = constructFiles(acceptedFiles);
    props.addFiles(conversation, activity, files, spark);
  }

  /**
   * Renders the conversation area of the widget
   *
   * @return {object}
   */

  renderConversation() {
    const props = this.props;
    const {
      conversation,
      spark,
      sparkState,
      user,
      widget
    } = props;
    const {formatMessage} = this.props.intl;
    const {
      avatars
    } = user;

    const {
      isLoadingHistoryUp
    } = conversation;

    let scrollButton;
    if (widget.showScrollToBottomButton) {
      const newMessages = {
        id: `newMessages`,
        defaultMessage: `New Messages`
      };
      const label = widget.hasNewMessage ? formatMessage(newMessages) : null;
      scrollButton = <ScrollToBottomButton label={label} onClick={this.handleScrollToBottom} />;
    }

    let deleteAlert;
    if (props.widget.showAlertModal) {
      const alertMessages = {
        title: formatMessage({
          id: `delete`,
          defaultMessage: `Delete`
        }),
        body: formatMessage({
          id: `confirmDeletingMessage`,
          defaultMessage: `Are you sure you want to delete this message?`
        }),
        actionButtonText: formatMessage({
          id: `delete`,
          defaultMessage: `Delete`
        }),
        cancelButtonText: formatMessage({
          id: `cancel`,
          defaultMessage: `Cancel`
        })
      };
      deleteAlert = ( // eslint-disable-line no-extra-parens
        <ConfirmationModal
          messages={alertMessages}
          onClickActionButton={this.handleConfirmActivityDelete}
          onClickCancelButton={this.handleCancelActivityDelete}
        />
      );
    }

    const toUser = this.getUserFromConversation(conversation);
    const toUserAvatar = avatars[toUser.id];
    const {displayName} = toUser;
    const placeholderMessage = {
      id: `sendAMessageToRoom`,
      defaultMessage: `Send a message to {displayName}`,
      description: `Placeholder value to show in message input field`
    };
    const messagePlaceholder = formatMessage(placeholderMessage, {displayName});

    const dropzoneProps = {
      activeClassName: styles.activeDropzone,
      className: styles.dropzone,
      disableClick: true,
      disablePreview: true,
      onDrop: this.handleFileDrop
    };

    return (
      <div className={classNames(`widget-message-meet-inner`, styles.widgetMessageMeetInner)}>
        <div className={classNames(`title-bar-wrapper`, styles.titleBarWrapper)}>
          <TitleBar
            connectionStatus={sparkState}
            displayName={displayName}
            image={toUserAvatar}
          />
        </div>
        <Dropzone {...dropzoneProps}>
          <div className={classNames(`activity-list-wrapper`, styles.activityListWrapper)}>
            <ScrollingActivity
              isLoadingHistoryUp={isLoadingHistoryUp}
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
          <div className={classNames(`dropzone-message`, styles.dropzoneMessage)}>
            <div className={classNames(`dropzone-message-title`, styles.dropzoneTitle)}>
              <FormattedMessage
                defaultMessage="Drag and drop your files here"
                id="dropFilesHere"
              />
            </div>
          </div>
        </Dropzone>
      </div>
    );
  }

  /**
   * Render
   *
   * @returns {Object}
   */
  render() {
    const props = this.props;
    const {
      conversation
    } = props;

    const widgetInner = conversation && conversation.isLoaded ? this.renderConversation() : <LoadingScreen />;

    return (
      <div className={classNames(`widget-message-meet`, styles.widgetMessageMeet)}>
        <div className={classNames(`banner`, styles.banner)} />
        {widgetInner}
        <Notifications />
      </div>
    );
  }
}

MessageMeetWidget.propTypes = {
  intl: intlShape.isRequired,
  toPersonEmail: PropTypes.string,
  toPersonId: PropTypes.string
};

function mapStateToProps(state) {
  return {
    activity: state.activity,
    share: state.share,
    spark: state.spark.get(`spark`),
    sparkState: state.spark.get(`status`).toJS(),
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
    acknowledgeActivityOnServer,
    addFiles,
    confirmDeleteActivity,
    createConversationWithUser,
    createNotification,
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
)(injectSpark(injectIntl(MessageMeetWidget)));
