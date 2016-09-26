import React, {Component} from 'react';
import {connect} from 'react-redux';

import {
  connectToMercury,
  updateSparkState
} from './actions';

class SparkComponent extends Component {

  componentDidMount() {
    const {
      spark
    } = this.props;

    spark.listenToAndRun(spark, `change:isAuthenticated`, () => {
      updateSparkState({authenticated: spark.isAuthenticated});
    });

    spark.listenToAndRun(spark, `change:isAuthenticating`, () => {
      updateSparkState({authenticating: spark.isAuthenticating});
    });

    spark.mercury.listenToAndRun(spark.mercury, `change:connected`, () => {
      updateSparkState({connected: spark.mercury.connected});
    });

    spark.mercury.listenToAndRun(spark.mercury, `change:connecting`, () => {
      updateSparkState({connecting: spark.mercury.connecting});
    });
  }

  componentWillReceiveProps(nextProps) {
    const {
      authenticated,
      authenticating,
      connected,
      connecting,
      spark
    } = nextProps;
    if (authenticated && !connected && !connecting && !authenticating) {
      connectToMercury(spark);
    }
  }

  render() {
    return null;
  }
}

SparkComponent.propTypes = {
  connectToMercury: React.PropTypes.func.isRequired,
  spark: React.PropTypes.object.isRequired,
  updateSparkState: React.PropTypes.func.isRequired
};

function mapStateToProps(state, ownProps) {
  return {
    connectToMercury,
    updateSparkState,
    spark: ownProps.spark
  };
}

export default connect(
  mapStateToProps
)(SparkComponent);
