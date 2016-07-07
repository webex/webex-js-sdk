import React, {Component} from 'react';

import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';
import {Button} from 'react-bootstrap';

import {injectSpark} from '../../modules/redux-spark';
import {loginWithUI} from '../../modules/redux-spark/actions';

class AuthPage extends Component {
  static propTypes = {
    loginWithUI: React.PropTypes.func.isRequired,
    spark: React.PropTypes.object.isRequired
  };

  handleLogin() {
    const {loginWithUI, spark} = this.props;
    loginWithUI(spark);
  }

  render() {
    return (
      <div className="auth">
        <Button onClick={this.handleLogin.bind(this)} title="Login with UI">Login With UI</Button>
      </div>
    );
  }
}

export default connect(
  (state) => state.spark,
  (dispatch) => bindActionCreators({loginWithUI}, dispatch)
)(injectSpark(AuthPage));
