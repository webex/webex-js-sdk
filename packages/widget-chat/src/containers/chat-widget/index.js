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

  componentWillReceiveProps(nextProps) {
    console.log(`componentDidMount`);
    console.log(nextProps);

    const {
      user,
      spark,
      userId
    } = nextProps;

    if (!user && spark) {
      nextProps.fetchUser(userId, spark);
    }
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
    fetchUser
  }, dispatch)
)(injectSpark(ChatWidget));
