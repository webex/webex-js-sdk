import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';

import ConnectionStatus from '../../components/connection-status';
import {fetchCurrentUser} from '../../actions/user';
import {createConversationWithUser} from '../../actions/conversation';
import ActivityTitleBar from '../../components/activity-title-bar';
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
      if (!user) {
        nextProps.fetchCurrentUser(spark);
      }
      if (!conversation) {
        nextProps.createConversationWithUser(userId, spark);
      }
    }

  }

  shouldComponentUpdate(nextProps) {
    const props = this.props;
    return nextProps.sparkState.connected !== props.sparkState.connected || nextProps.user !== props.user || nextProps.conversation !== props.conversation;
  }

  /**
   * Render
   *
   * @returns {Object}
   *
   * @memberOf ChatWidget
   */
  render() {
    const {userId} = this.props;
    const props = this.props;
    const user = {userId, avatar: ``};

    const {
      conversation,
      sparkState} = props;
    const {
      activities,
      id,
      participants
    } = conversation;

    return (
      <div className={classNames(`widget-chat`, styles.widgetChat)}>
        <ActivityTitleBar user={user} />
        <ActivityList activities={activities} id={id} participants={participants} />
        <MessageComposer />
        <ConnectionStatus id="connection-status" {...sparkState} />
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
