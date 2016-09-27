import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import classNames from 'classnames';

import ConnectionStatus from '../../components/connection-status';
import ActivityTitle from '../../components/activity-title';
import styles from './styles.css';

import injectSpark from '../../modules/redux-spark/inject-spark';

/**
 * ChatWidget Component
 *
 * @export
 * @class ChatWidget
 * @extends {React.Component}
 */
class ChatWidget extends Component {

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
  dispatch: PropTypes.func.isRequired,
  isFetching: PropTypes.bool.isRequired,
  spark: React.PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  userId: PropTypes.string.isRequired
};

function mapStateToProps(state, ownProps) {
  const {user} = state;
  const {
    isFetching,
    item
  } = user || {
    isFetching: true,
    item: []
  };

  return Object.assign({}, state.spark, {
    user,
    isFetching,
    item,
    userId: ownProps.userId,
    spark: ownProps.spark
  });
}

export default connect(
  mapStateToProps
)(injectSpark(ChatWidget));
