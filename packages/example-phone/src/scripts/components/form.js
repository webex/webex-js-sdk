import React, {Component} from 'react';

import {Form as BootstrapForm} from 'react-bootstrap';

export default class Form extends BootstrapForm {
  static propTypes = {
    children: React.PropTypes.node.isRequired,
    onChange: React.PropTypes.func,
    onSubmit: React.PropTypes.func.isRequired
  };

  handleChange(event) {
    // I still haven't found a method better than setState for dealing with form
    // data
    /* eslint react/no-set-state: [0] */
    let value = event.target.value;
    if (event.target.type === `checkbox`) {
      value = value === `on`;
    }
    this.setState({[event.target.name]: value});
    if (this.props.onChange) {
      this.props.onChange(event);
    }
  }

  handleSubmit(event) {
    event.preventDefault();
    this.props.onSubmit(this.state);
  }

  render() {
    /* eslint no-unused-vars: [0] */

    const {
      onChange,
      onSubmit,
      children,
      ...props
    } = this.props;

    return (
      <form
        onChange={this.handleChange.bind(this)}
        onSubmit={this.handleSubmit.bind(this)}
        {...props} {...this.state}
      >
        {children}
      </form>
    );
  }
}
