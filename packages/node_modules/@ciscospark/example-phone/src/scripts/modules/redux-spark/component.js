import React, {Component} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';

import injectSpark from './inject';

import {
  connectToMercury,
  updateState
} from './actions';

class SparkComponent extends Component {
  static propTypes = {
    connectToMercury: React.PropTypes.func.isRequired,
    spark: React.PropTypes.object.isRequired,
    updateState: React.PropTypes.func.isRequired
  };

  componentDidMount() {
    const {
      updateState,
      spark
    } = this.props;

    spark.listenToAndRun(spark, `change:isAuthenticated`, () => {
      updateState({authenticated: spark.isAuthenticated});
    });

    spark.listenToAndRun(spark, `change:isAuthenticating`, () => {
      updateState({authenticating: spark.isAuthenticating});
    });

    spark.mercury.listenToAndRun(spark.mercury, `change:connected`, () => {
      updateState({connected: spark.mercury.connected});
    });

    spark.mercury.listenToAndRun(spark.mercury, `change:connecting`, () => {
      updateState({connecting: spark.mercury.connecting});
    });
  }

  componentWillReceiveProps(nextProps) {
    const {
      authenticated,
      connected,
      connecting,
      connectToMercury,
      spark
    } = nextProps;
    if (authenticated && !connected && !connecting) {
      connectToMercury(spark);
    }
  }

  render() {
    return null;
  }
}

export default connect(
  (state) => state.spark,
  (dispatch) => bindActionCreators({
    connectToMercury,
    updateState
  }, dispatch)
)(injectSpark(SparkComponent));
