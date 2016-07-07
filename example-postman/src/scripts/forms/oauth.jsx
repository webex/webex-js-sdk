/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import LinkedStateMixin from 'react-addons-linked-state-mixin';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import React from 'react';

const OAuthForm = React.createClass({
  propTypes: {
    onSubmit: React.PropTypes.func.isRequired
  },

  mixins: [
    LinkedStateMixin,
    PureRenderMixin
  ],

  getInitialState() {
    return {
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      scope: process.env.SCOPE
    };
  },

  onSubmit(event) {
    event.preventDefault();
    this.props.onSubmit({
      client_id: this.state.clientId,
      client_secret: this.state.clientSecret,
      scope: this.state.scope
    });
  },

  render() {
    return (
      <form onSubmit={this.onSubmit}>
        <label>
          Client ID
          <input required={true} type="text" valueLink={this.linkState('clientId')} />
        </label>
        <label>
          Client Secret
          <input required={true} type="text" valueLink={this.linkState('clientSecret')} />
        </label>
        <label>
          Scopes
          <input required={true} type="text" valueLink={this.linkState('scope')} />
        </label>
        <p>You must specify "{process.env.REDIRECT_URI || 'http://127.0.0.1:8000'}" as your `redirect_uri`</p>
        <input type="submit" value="submit" />
      </form>
    )
  }
});

export default OAuthForm;
