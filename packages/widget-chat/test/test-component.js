import React, {Component, PropTypes} from 'react';
import {Provider, connect} from 'react-redux';
import injectSpark from '../src/modules/redux-spark/inject-spark';

function TestWidget(props) {
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
