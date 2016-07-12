import React, {Component} from 'react';
import {Col, Grid, Row, Well} from 'react-bootstrap';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';

import {injectSpark} from '../../modules/redux-spark';

import Dialer from '../../components/call/dialer';

import CallPageHeader from '../page-sections/call-page-header';
import CallPageBody from '../page-sections/call-page-body';

import {answer, decline} from '../../actions/incoming-call';
import {dial} from '../../actions/phone';

class CallPage extends Component {
  static propTypes = {
    answer: React.PropTypes.func.isRequired,
    calls: React.PropTypes.array.isRequired,
    decline: React.PropTypes.func.isRequired,
    dial: React.PropTypes.func.isRequired,
    lastCall: React.PropTypes.object,
    spark: React.PropTypes.object.isRequired
  }

  handleAnswer(call) {
    const {answer, spark} = this.props;
    answer(spark, call);
  }

  handleDecline(call) {
    const {decline} = this.props;
    decline(call);
  }

  render() {
    const {dial, spark} = this.props;

    return (
      <Grid className="call" fluid>
        <Row>
          <Col sm={3}>
            <Well>
              <Dialer onDial={dial} spark={spark} />
            </Well>
          </Col>
          <Col sm={9}>
            <Grid fluid>
              <Row>
                <Col sm={12} >
                  <CallPageHeader />
                </Col>
              </Row>
              <Row>
                <Col sm={12} >
                  <CallPageBody />
                </Col>
              </Row>
            </Grid>
          </Col>
        </Row>
      </Grid>
    );
  }
}

export default connect(
  (state) => ({
    calls: state.incomingCalls,
    call: state.activeCall.call
  }),
  (dispatch) => bindActionCreators({
    answer,
    decline,
    dial
  }, dispatch)
)(injectSpark(CallPage));
