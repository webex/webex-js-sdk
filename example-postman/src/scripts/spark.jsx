/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {load, store} from './lib/sync-storage';
import React from 'react';
import Spark from 'spark-js-sdk';

let spark;

const SparkElement = React.createClass({
  propTypes: {
    children: React.PropTypes.node.isRequired
  },

  componentDidMount() {
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
              redirect_uri: 'http://127.0.0.1:8000',
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

    spark.on('change:authenticated', () => {
      this.setState({
        authenticated: spark.authenticated
      });
    });
  },

  render() {
    return this.props.children
  }

});

export default SparkElement;
