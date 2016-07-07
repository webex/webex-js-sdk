import React from 'react';
import {connect} from 'react-redux';
import {PageHeader} from 'react-bootstrap';

function CallPageHeader({callStatus}) {
  return (
    <PageHeader>Call Status: <small className="call-status">{callStatus}</small></PageHeader>
  );
}

CallPageHeader.propTypes = {
  callStatus: React.PropTypes.string.isRequired
};

export default connect(
  (state) => ({
    callStatus: state.activeCall.status
  })
)(CallPageHeader);
