/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {load, store} from './lib/sync-storage';
import React from 'react';
import Spark from 'spark-js-sdk';

let spark;

export default function bindToSpark(Component) {
  const SparkElement = React.createClass({
    getInitialState() {
      return {
        authenticated: false
      };
    },

    componentWillMount() {
      if (!spark) {
        const credentials = load('credentials');
        const device = load('device');
        const oauth = load('oauth');

        window.spark = spark = new Spark({
          credentials,
          device,
          config: {
            credentials: {
              oauth: Object.assign({
                /* eslint camelcase: [0] */
                client_id: 'placeholder',
                client_secret: 'placeholder',
                redirect_uri: process.env.REDIRECT_URI || 'http://127.0.0.1:8000',
                service: 'spark',
                scope: 'placeholder'
              }, oauth)
            },
            logger: {
              level: 'trace'
            },
            trackingIdPrefix: 'js-example-postman'
          }
        });

        spark.listenToAndRun(spark, 'change:device', () => {
          store('device', spark.device);
        });

        spark.listenToAndRun(spark, 'change:credentials', () => {
          store('credentials', spark.credentials);
        });
      }

      this.setState({
        spark
      });

      spark.listenToAndRun(spark, 'change:isAuthenticated', () => {
        this.setState({
          authenticated: !!spark.isAuthenticated,
          authenticating: !!spark.isAuthenticating
        });
      });

      // If we already have credentials, we want to kick off a token refresh (if
      // needed) and a device refresh.
      if (spark.isAuthenticated) {
        spark.authenticate();
      }
    },

    render() {
      return <Component {...this.props} {...this.state} />
    }
  })

  return SparkElement;
}
