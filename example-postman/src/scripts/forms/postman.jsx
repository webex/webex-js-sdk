/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import LinkedStateMixin from 'react-addons-linked-state-mixin';
import parse from '../lib/parse';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import React from 'react';

const PostmanForm = React.createClass({
  propTypes: {
    request: React.PropTypes.func.isRequired
  },

  mixins: [
    LinkedStateMixin,
    PureRenderMixin
  ],

  getInitialState() {
    return {
      submitting: false,
      error: false,
      api: 'conversation',
      resource: 'conversations',
      qs: JSON.stringify({
        activitiesLimit: 0,
        conversationsLimit: 1,
        participantsLimit: 0
      }, null, 2)
    }
  },

  onSubmit(event) {
    event.preventDefault();
    this.setState({
      error: false,
      submitting: true
    });

    this.props.request({
      method: this.state.method,
      api: this.state.api,
      resource: this.state.resource,
      body: parse(this.state.body),
      qs: parse(this.state.qs)
    })
      .catch((reason) => {
        this.setState({error: true})
        console.error(reason);
        return reason;
      })
      .then((res) => {
        this.setState({
          submitting: false,
          responseCode: res.statusCode,
          responseBody: JSON.stringify(res.body, null, 2)
        });
      });
  },

  render() {
    return (
      <div>
        <form onSubmit={this.onSubmit}>
          <select valueLink={this.linkState('method')}>
            {['GET', 'POST', 'DELETE', 'PUT'].map((method) => (<option key={method} value={method}>{method}</option>))}
          </select>
          <label>
            API
            <input required={true} type="text" valueLink={this.linkState('api')}/>
          </label>
          <label>
            Resource
            <input required={true} type="text" valueLink={this.linkState('resource')}/>
          </label>
          <label>
            Body
            <textarea valueLink={this.linkState('body')}/>
          </label>
          <label>
            querystring
            <textarea valueLink={this.linkState('qs')}/>
          </label>
          <input type="submit" value="submit" />
        </form>
        <pre>{this.state.responseBody}</pre>
      </div>
    )
  }
});

export default PostmanForm;
