import {Component, PropTypes} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';

import {
  connectToMercury,
  updateSparkStatus,
  registerDevice,
  storeSparkInstance
} from './actions';

import createSpark from './spark';

class SparkComponent extends Component {

  componentDidMount() {
    const {
      accessToken
    } = this.props;

    const props = this.props;
    let spark = props.spark.get(`spark`);

    if (!spark) {
      spark = createSpark(accessToken);
      props.storeSparkInstance(spark);
    }

    spark.listenToAndRun(spark, `change:canAuthorize`, () => {
      props.updateSparkStatus({authenticated: spark.canAuthorize});
    });

    spark.listenToAndRun(spark, `change:isAuthenticating`, () => {
      props.updateSparkStatus({authenticating: spark.isAuthenticating});
    });

    spark.mercury.listenToAndRun(spark.mercury, `change:connected`, () => {
      props.updateSparkStatus({connected: spark.mercury.connected});
    });

    if (props.authenticated && !props.registered && !props.registering) {
      props.registerDevice(spark);
    }
  }

  componentWillReceiveProps(nextProps) {
    const {
      connected,
      connecting,
      authenticated,
      registered,
      registering
    } = nextProps.spark.get(`status`).toJS();
    const spark = nextProps.spark.get(`spark`);

    if (authenticated && !registered && !registering) {
      nextProps.registerDevice(spark);
    }
    else if (registered && authenticated && !connected && !connecting) {
      nextProps.connectToMercury(spark);
    }
  }

  shouldComponentUpdate(nextProps) {
    const props = this.props;
    return nextProps !== props;
  }

  render() {
    return null;
  }
}

SparkComponent.propTypes = {
  accessToken: PropTypes.string.isRequired
};

export default connect(
  (state) => ({
    spark: state.spark
  }),
  (dispatch) => bindActionCreators({
    connectToMercury,
    updateSparkStatus,
    registerDevice,
    storeSparkInstance
  }, dispatch)
)(SparkComponent);
