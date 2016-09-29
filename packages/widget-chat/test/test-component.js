import React from 'react';
import {connect} from 'react-redux';
import injectSpark from '../src/modules/redux-spark/inject-spark';

function TestWidget() {
  return <div>TestWidget</div>;
}

function mapStateToProps(state, ownProps) {
  return Object.assign({}, state.spark, {
    spark: ownProps.spark
  });
}

export default connect(
  mapStateToProps
)(injectSpark(TestWidget));
