/* eslint-disable react/no-set-state, global-require, camelcase */
import React, {Component, PropTypes} from 'react';
import classNames from 'classnames';
import Spark from '@ciscospark/spark-core';

import styles from './styles.css';

import SparkLogo from '../spark-logo';

class WidgetDataInput extends Component {
  constructor(props) {
    super(props);
    const l = window.location;
    const redirectUri = `${l.protocol}//${l.host}${l.pathname}`.replace(/\/$/, ``);
    this.spark = new Spark({
      config: {
        credentials: {
          oauth: {
            client_id: `C6acec3fac30d32ed481f3592d4b96ea9a55214f91cc285486ab0d1fe26d180ad`,
            client_secret: `eed978411377926971722de5c4d7b11b625df01137eec9a51c6a92d62acedfc3`,
            scope: `spark:rooms_read spark:rooms_write spark:memberships_read spark:memberships_write spark:messages_read spark:messages_write`,
            redirect_uri: redirectUri
          }
        }
      }
    });
    this.spark.listenToAndRun(this.spark, `change:isAuthenticated`, () => {
      this.checkForOauthToken();
    });
    const {accessToken, toPersonEmail} = props;
    const error = false;
    this.state = {
      accessToken,
      error,
      toPersonEmail
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleAuth = (e) => {
      e.preventDefault();
      this.spark.authenticate();
    };
    this.handleAccessTokenChange = (e) => this.setState({accessToken: e.target.value});
    this.handleEmailChange = (e) => this.setState({toPersonEmail: e.target.value});
    this.checkForOauthToken();
  }

  shouldComponentUpdate() {
    return true;
  }

  handleSubmit(e) {
    e.preventDefault();
    this.setState({error: false});
    if (this.validateForm(this.state)) {
      this.props.onSubmit(this.state);
    }
    else {
      this.setState({error: true});
    }
  }

  validateForm(state) {
    return state.accessToken && state.toPersonEmail;
  }

  checkForOauthToken() {
    if (this.spark.credentials.authorization && this.spark.credentials.authorization.access_token) {
      const token = this.spark.credentials.authorization.access_token;
      this.setState({accessToken: token});
    }
  }

  render() {
    const error = this.state.error ? <div>{`Please fill a user and token`}</div> : ``;
    return (
      <div className={classNames(`widget-container`, styles.widgetContainer)}>
        <SparkLogo />
        <form className={classNames(`widget-props-form`, styles.widgetPropsForm)} ref={this.getForm}>
          <div className={classNames(`field-wrapper`, styles.fieldWrapper)}>
            <input
              className={classNames(`field-input`, styles.fieldInput)}
              onChange={this.handleEmailChange}
              placeholder="User Email"
              type="text"
              value={this.state ? this.state.toPersonEmail : ``}
            />
          </div>
          <div className={classNames(`field-wrapper`, styles.fieldWrapper)}>
            <input
              className={classNames(`field-input`, styles.fieldInput)}
              onChange={this.handleAccessTokenChange}
              placeholder="Access Token"
              type="text"
              value={this.state ? this.state.accessToken : ``}
            />
            <button className={classNames(`props-submit`, styles.propsSubmit)} onClick={this.handleAuth}>{`OAuth`}</button>
          </div>
          <div className={classNames(`field-wrapper`, styles.fieldWrapper)}>
            <button className={classNames(`props-submit`, styles.propsSubmit)} onClick={this.handleSubmit}>{`Go Meet!`}</button>
            {error}
          </div>
        </form>
      </div>
    );
  }
}

WidgetDataInput.propTypes = {
  accessToken: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  toPersonEmail: PropTypes.string
};

export default WidgetDataInput;
