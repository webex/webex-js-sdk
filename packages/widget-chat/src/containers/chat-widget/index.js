import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';

import ConnectionStatus from '../../components/connection-status';
import {fetchUser, fetchCurrentUser} from '../../actions/user';
import ActivityTitleBar from '../../components/activity-title-bar';
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
      authenticated,
      connected,
      user,
      registered,
      spark
    } = nextProps;

    if (!user && spark && connected && authenticated && registered) {
      nextProps.fetchCurrentUser(spark);
    }
  }

  shouldComponentUpdate(nextProps) {
    const props = this.props;
    return nextProps.connected !== props.connected || nextProps.user !== props.user;
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
    return (
      <div className={classNames(`widget-chat`, styles.widgetChat)}>
        <ActivityTitleBar user={user} />
        <ConnectionStatus id="connection-status" {...props} />
      </div>
    );
  }
}

ChatWidget.propTypes = {
  fetchCurrentUser: PropTypes.func.isRequired,
  fetchUser: PropTypes.func.isRequired,
  spark: PropTypes.object.isRequired,
  userId: PropTypes.string.isRequired
};

function mapStateToProps(state, ownProps) {
  return Object.assign({}, state.spark, {
    spark: ownProps.spark
  });
}

export default connect(
  mapStateToProps,
  (dispatch) => bindActionCreators({
    fetchUser,
    fetchCurrentUser
  }, dispatch)
)(injectSpark(ChatWidget));
