import React from 'react';
import {Well} from 'react-bootstrap';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import IncomingCallAlertList from '../../components/incoming-call-alert-list';
import {injectSpark} from '../../modules/redux-spark';
import {answer, decline} from '../../actions/incoming-call';

function IncomingCallPanel({calls, ...rest}) {
  if (calls.length === 0) {
    return null;
  }

  return (
    <Well>
      <IncomingCallAlertList calls={calls} {...rest} />
    </Well>
  );
}

IncomingCallPanel.propTypes = {
  calls: React.PropTypes.array.isRequired
};

export default connect(
  (state) => ({
    calls: state.incomingCalls || []
  }),
  (dispatch) => bindActionCreators({
    onAnswer: answer,
    onDecline: decline
  }, dispatch)
)(injectSpark(IncomingCallPanel));
