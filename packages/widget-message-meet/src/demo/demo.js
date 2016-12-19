/* eslint-disable react/no-set-state, global-require */
import React, {Component} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

import SparkLogo from '../components/spark-logo';

const MODE_REACT = `MODE_REACT`;
const MODE_INLINE = `MODE_INLINE`;

class DemoApp extends Component {
  constructor() {
    super();
    this.state = {
      mode: MODE_REACT,
      accessToken: ``,
      toUser: ``,
      error: false
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleAccessTokenChange = this.handleAccessTokenChange.bind(this);
    this.handleEmailChange = this.handleEmailChange.bind(this);
  }

  shouldComponentUpdate() {
    return true;
  }

  handleSubmit(e) {
    e.preventDefault();
    this.setState({error: false});
    if (this.validateForm(this.state)) {
      this.createWidget(this.state);
    }
    else {
      this.setState({error: true});
    }
  }

  handleAccessTokenChange(e) {
    return this.setState({accessToken: e.target.value});
  }

  handleEmailChange(e) {
    return this.setState({toPersonEmail: e.target.value});
  }

  createWidget(state){

  }

  render() {
    const error = this.state.error ? <div>{`Please fill a user and token`}</div> : ``;
    return (
      <div>
        <div className="logo">
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
          <button className={classNames(`props-submit`, styles.propsSubmit)} onClick={this.handleSubmit}>{`Chat`}</button>
          {error}
        </form>
        <div className={classNames(`widget-component-container`, styles.widgetComponentContainer)} />
      </div>
    );
  }
}

DemoApp.propTypes = {

};

export default DemoApp;
