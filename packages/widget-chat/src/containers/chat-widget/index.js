import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import classNames from 'classnames';

import ConnectionStatus from '../../components/connection-status';
import ActivityTitle from '../../components/activity-title';
import {fetchUser} from '../../actions/user';
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

  componentDidMount() {
    const props = this.props;
    if (!props.user) {
      props.fetchUser(props.userId);
    }
  }

  shouldComponentUpdate() {
    return false;
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
    return (
      <div className={classNames(`widget-chat`, styles.widgetChat)}>
        <ActivityTitle heading={userId} />
        <ConnectionStatus id="connection-status" {...props} />
      </div>
    );
  }
}

ChatWidget.propTypes = {
  fetchUser: PropTypes.func.isRequired,
  spark: React.PropTypes.object.isRequired,
  userId: PropTypes.string.isRequired
};

export default connect(
  (state) => state.spark,
  (dispatch) => bindActionCreators({
    fetchUser
  }, dispatch)
)(injectSpark(ChatWidget));
