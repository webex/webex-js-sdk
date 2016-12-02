import React, {Component} from 'react';
import {Col, Grid, Jumbotron, Row, Well} from 'react-bootstrap';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';
import {Link} from 'react-router';

import {injectSpark} from '../../modules/redux-spark';

import Dialer from '../../components/call/dialer';

import CallPageHeader from '../page-sections/call-page-header';
import CallPageBody from '../page-sections/call-page-body';

import {answer, decline} from '../../actions/incoming-call';
import {dial} from '../../actions/phone';

class CallPage extends Component {
  /* eslint-disable react/no-unused-prop-types */
  static propTypes = {
    answer: React.PropTypes.func.isRequired,
    calls: React.PropTypes.array.isRequired,
    decline: React.PropTypes.func.isRequired,
    dial: React.PropTypes.func.isRequired,
    lastCall: React.PropTypes.object,
    spark: React.PropTypes.object.isRequired
  }
  /* eslint-disable react/no-unused-prop-types */

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
    /* eslint-disable react/forbid-component-props */
    return (
      <Grid className="call" fluid>
        <Row>
          <Col sm={12}>
            <Jumbotron>
              <p>{`The calling feature in the SDK is currently available in limited beta. If you'd like to join the beta program and share your feedback, please visit the `}<Link href="https://developer.ciscospark.com/sdkaccess/" target="_blank">{`developer portal`}</Link>{`. If you qualify, a Cisco employee will reach out to you.`}</p>
            </Jumbotron>
          </Col>
        </Row>
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
    /* eslint-enable react/forbid-component-props */
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
