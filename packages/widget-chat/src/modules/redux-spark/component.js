import {Component, PropTypes} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';

import {
  connectToMercury,
  updateSparkState,
  registerDevice
} from './actions';

class SparkComponent extends Component {

  componentDidMount() {
    const props = this.props;

    const {spark} = props;
    spark.listenToAndRun(spark, `change:isAuthenticated`, () => {
      props.updateSparkState({authenticated: spark.isAuthenticated});
    });

    spark.listenToAndRun(spark, `change:isAuthenticating`, () => {
      props.updateSparkState({authenticating: spark.isAuthenticating});
    });

    spark.mercury.listenToAndRun(spark.mercury, `change:connected`, () => {
      props.updateSparkState({connected: spark.mercury.connected});
    });

    spark.device.listenToAndRun(spark.device, `change:registered`, () => {
      props.updateSparkState({registered: spark.device.registered});
    });

    if (!props.registered) {
      props.registerDevice(props.spark);
    }
  }

  componentWillReceiveProps(nextProps) {
    const {
      connected,
      connecting,
      authenticated,
      registered,
      spark
    } = nextProps;
    if (!registered) {
      nextProps.registerDevice(spark);
    }
    if (authenticated && !connected && !connecting) {
      nextProps.connectToMercury(spark);
    }
  }

  shouldComponentUpdate() {
    return false;
  }

  render() {
    return null;
  }
}

SparkComponent.propTypes = {
  connectToMercury: PropTypes.func.isRequired,
  registerDevice: PropTypes.func.isRequired,
  spark: PropTypes.object.isRequired,
  updateSparkState: PropTypes.func.isRequired
};

export default connect(
  (state) => state.spark,
  (dispatch) => bindActionCreators({
    connectToMercury,
    updateSparkState,
    registerDevice
  }, dispatch)
)(SparkComponent);
