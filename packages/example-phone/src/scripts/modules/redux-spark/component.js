import React, {Component} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';

import injectSpark from './inject';

import {
  connectToMercury,
  receiveCredentials,
  receiveDevice,
  updateState
} from './actions';

class SparkComponent extends Component {
  static propTypes = {
    connectToMercury: React.PropTypes.func.isRequired,
    credentials: React.PropTypes.object,
    device: React.PropTypes.object,
    receiveCredentials: React.PropTypes.func.isRequired,
    receiveDevice: React.PropTypes.func.isRequired,
    spark: React.PropTypes.object.isRequired,
    updateState: React.PropTypes.func.isRequired
  };

  componentDidMount() {
    const {
      credentials,
      device,
      updateState,
      receiveDevice,
      receiveCredentials,
      spark
    } = this.props;

    if (credentials) {
      spark.credentials.set(credentials);
    }

    if (device) {
      spark.device.set(device);
    }

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

    spark.credentials.on(`change:authorization`, () => {
      receiveCredentials(spark);
    });

    spark.device.on(`change:url`, () => {
      receiveDevice(spark);
    });

    spark.device.on(`change:webSocketUrl`, () => {
      receiveDevice(spark);
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
    receiveCredentials,
    receiveDevice,
    updateState
  }, dispatch)
)(injectSpark(SparkComponent));
