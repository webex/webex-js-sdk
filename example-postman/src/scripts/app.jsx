/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import bindToSpark from './bind-to-spark.jsx';
import OAuthForm from './forms/oauth.jsx';
import PostmanForm from './forms/postman.jsx';
import React from 'react';

const App = React.createClass({
  propTypes: {
    authenticated: React.PropTypes.bool.isRequired,
    spark: React.PropTypes.object.isRequired
  },

  login(oauth) {
    const spark = this.props.spark;
    Object.assign(spark.config.credentials.oauth, oauth);
    spark.authenticate();
  },

  render() {
    const {
      authenticated,
      spark
    } = this.props;

    let ifAuthenticated;
    if (authenticated) {
      ifAuthenticated = (
        <PostmanForm request={(...args) => spark.request(...args)} />
      );
    }

    return (
      <div>
        <OAuthForm onSubmit={this.login}/>
        {ifAuthenticated}
      </div>
    );
  }
});

const SparkApp = bindToSpark(App);

export default SparkApp;
