/* eslint-disable react/no-set-state */
import React, {Component} from 'react';
import classNames from 'classnames';

import '../styles/fonts.css';
import styles from './styles.css';

import SparkLogo from '../components/spark-logo';

import ExampleCode, {MODE_REACT, MODE_INLINE} from './example-code';

import Root from '../root';
import SparkOAuth from './oauth';


class DemoApp extends Component {
  constructor() {
    super();
    this.state = {
      authenticate: false,
      mode: MODE_INLINE,
      accessToken: ``,
      toPersonEmail: ``,
      running: false
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleAccessTokenChange = this.handleAccessTokenChange.bind(this);
    this.handleEmailChange = this.handleEmailChange.bind(this);
    this.handleModeChange = this.handleModeChange.bind(this);
    this.handleLoginOAuth = this.handleLoginOAuth.bind(this);
    this.handleOnAuth = this.handleOnAuth.bind(this);
  }

  shouldComponentUpdate() {
    return true;
  }

  handleSubmit(e) {
    e.preventDefault();
    this.setState({running: true});
  }

  handleAccessTokenChange(e) {
    return this.setState({accessToken: e.target.value});
  }

  handleEmailChange(e) {
    return this.setState({toPersonEmail: e.target.value});
  }

  handleModeChange(e) {
    return this.setState({mode: e.target.value});
  }

  handleLoginOAuth(e) {
    e.preventDefault();
    this.setState({authenticate: true});
  }

  handleOnAuth(token) {
    return this.setState({accessToken: token, authenticate: false});
  }


  createWidget(e) {
    e.preventDefault();
    return this.setState({running: true});
  }

  render() {
    const loadButtonEnabled = this.state.accessToken && this.state.toPersonEmail;
    if (this.state.running) {
      return (
        <div className={classNames(`widget-component-container`, styles.widgetComponentContainer)}>
          <Root accessToken={this.state.accessToken} toPersonEmail={this.state.toPersonEmail} />
        </div>);
    }
    return (
      <div className={classNames(`demo-wrapper`, styles.demoWrapper)}>
        <div className={classNames(`logo`, styles.logo)}>
          <SparkLogo />
        </div>
        <form className={classNames(`demo-form`, styles.demoForm)}>
          <div className={classNames(`field-wrapper`, styles.fieldWrapper)}>
            <input
              className={classNames(`field-input`, styles.fieldInput)}
              onChange={this.handleEmailChange}
              placeholder="To User Email"
              type="text"
              value={this.state.toPersonEmail}
            />
          </div>
          <div className={classNames(`field-wrapper`, styles.fieldWrapper)}>
            <input
              className={classNames(`field-input`, styles.fieldInput)}
              onChange={this.handleAccessTokenChange}
              placeholder="Your Access Token"
              type="text"
              value={this.state.accessToken}
            />
          </div>
          <div className={classNames(`field-wrapper`, styles.fieldWrapper)}>
            <button
              className={classNames(`button-small`, styles.buttonSmall)}
              onClick={this.handleLoginOAuth}
            >
              {`Login with Spark`}
            </button>
          </div>
          <div className={classNames(`field-wrapper`, styles.fieldWrapper)}>
            <a href="http://developer.ciscospark.com">{`Get access token from developer.ciscospark.com`}</a>
          </div>
          <div className={classNames(`field-wrapper`, styles.fieldWrapper)}>
            <div className={classNames(`radio-group`, styles.radioGroup)}>
              <div className={classNames(`radio-item`, styles.radioItem)}>
                <input
                  checked={this.state.mode === MODE_INLINE}
                  id="radio_inline"
                  onChange={this.handleModeChange}
                  type="radio"
                  value={MODE_INLINE}
                />
                <label htmlFor="radio_inline">
                  {`Inline Mode`}
                </label>
              </div>
              <div className={classNames(`radio-item`, styles.radioItem)}>
                <input
                  checked={this.state.mode === MODE_REACT}
                  id="radio_react"
                  onChange={this.handleModeChange}
                  type="radio"
                  value={MODE_REACT}
                />
                <label htmlFor="radio_react">
                  {`React Component`}
                </label>
              </div>
            </div>
          </div>
          <div className={classNames(`example-code`, styles.exampleCode)}>
            <ExampleCode accessToken={this.state.accessToken} toPersonEmail={this.state.toPersonEmail} type={this.state.mode} />
          </div>
          <button
            className={classNames(`button`, styles.button)}
            disabled={!loadButtonEnabled}
            onClick={this.handleSubmit}
          >
            {`Load Widget`}
          </button>
          <SparkOAuth doAuth={this.state.authenticate} onAuth={this.handleOnAuth} />
        </form>
      </div>
    );
  }
}

export default DemoApp;
