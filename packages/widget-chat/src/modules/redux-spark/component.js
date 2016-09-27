import React, {Component} from 'react';
import {bindActionCreators} from 'redux';
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

    spark.mercury.listenToAndRun(spark.mercury, `change:connected`, () => {
      updateSparkState({connected: spark.mercury.connected});
    });

    spark.mercury.listenToAndRun(spark.mercury, `change:connecting`, () => {
      updateSparkState({connecting: spark.mercury.connecting});
    });

    this.props.connectToMercury(spark);
  }

  componentWillReceiveProps(nextProps) {
    const {
      connected,
      connecting,
      spark
    } = nextProps;
    if (!connected && !connecting) {
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

export default connect(
  (state) => state.spark,
  (dispatch) => bindActionCreators({
    connectToMercury,
    updateSparkState
  }, dispatch)
)(SparkComponent);
