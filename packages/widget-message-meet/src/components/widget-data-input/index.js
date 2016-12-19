/* eslint-disable react/no-set-state, global-require */
import React, {Component, PropTypes} from 'react';
import classNames from 'classnames';

import styles from './styles.css';

import SparkLogo from '../spark-logo';

class WidgetDataInput extends Component {
  constructor(props) {
    super(props);
    const {accessToken, toPersonEmail} = props;
    const error = false;
    this.state = {
      accessToken,
      error,
      toPersonEmail
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
      this.props.onSubmit(this.state);
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

  validateForm(state) {
    return state.accessToken && state.toPersonEmail;
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
