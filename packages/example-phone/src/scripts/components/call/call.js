import React from 'react';
import CallControls from './call-controls';
import {Col, Grid, Row} from 'react-bootstrap';
import SelfView from './call-self-view';
import RemoteView from './call-remote-view';

export default function Call({remoteName, ...props}) {
  return (
    <div className="active-call">
      <Grid>
        <Row>
          <Col sm={12}>
            <h2>Call with <span className="remote-party-name">{remoteName}</span></h2>
          </Col>
        </Row>
      </Grid>
      <Grid fluid>
        <Row>
          <Col sm={6}>
            <SelfView {...props} />
          </Col>
          <Col sm={6}>
            <RemoteView {...props} />
          </Col>
        </Row>
        <Row>
          <Col sm={12}>
            <CallControls {...props} />
          </Col>
        </Row>
      </Grid>
    </div>
  );
}

Call.propTypes = {
  remoteName: React.PropTypes.string.isRequired
};
