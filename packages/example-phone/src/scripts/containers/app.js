import React, {Component} from 'react';
import {Nav, NavItem, Navbar} from 'react-bootstrap';
import {Link} from 'react-router';
import {LinkContainer} from 'react-router-bootstrap';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import SparkComponent from '../modules/redux-spark/component.js';
import {injectSpark} from '../modules/redux-spark';
import {ring} from '../actions/incoming-call.js';

import AuthStatus from '../components/auth-status';
import ConnectionStatus from '../components/connection-status';
import IncomingCallPanel from './page-sections/incoming-call-panel';

class App extends Component {
  componentWillMount() {
    // TODO Consider moving this to CallPage
    const {ring, spark} = this.props;
    spark.phone.on(`call:incoming`, (call) => ring(call));
  }

  render() {
    const {children, ...props} = this.props;

    return (
      <div className="app ready">
        <SparkComponent />
        <Navbar inverse>
          <Navbar.Header>
            <Navbar.Brand>
              <Link to="/">CiscoSpark SDK Example</Link>
            </Navbar.Brand>
            <Navbar.Toggle />
          </Navbar.Header>
          <Navbar.Collapse>
            <Nav>
              <LinkContainer to={`/auth`}>
                <NavItem title="Link to Auth Page">Auth</NavItem>
              </LinkContainer>
              <LinkContainer to={`/call`}>
                <NavItem title="Link to Call Page">Call</NavItem>
              </LinkContainer>
            </Nav>
            <p className="navbar-text navbar-right">
              <AuthStatus id="auth-status" {...props} />
            </p>
            <p className="navbar-text navbar-right">
              <ConnectionStatus id="connection-status" {...props} />
            </p>
          </Navbar.Collapse>
        </Navbar>
        <IncomingCallPanel />
        {children}
      </div>
    );
  }
}

App.propTypes = {
  children: React.PropTypes.node,
  ring: React.PropTypes.func.isRequired,
  spark: React.PropTypes.object.isRequired
};

export default connect(
  (state) => state.spark,
  (dispatch) => bindActionCreators({ring}, dispatch)
)(injectSpark(App));
