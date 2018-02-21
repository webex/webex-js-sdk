/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser */

import '@ciscospark/plugin-authorization-browser';
import StorageAdapterLocalStorage from '@ciscospark/storage-adapter-local-storage';
import Spark from '@ciscospark/spark-core';
import pkg from '../../../package';

const spark = window.spark = new Spark({
  config: {
    credentials: {
      refreshCallback(spark, token) {
        return spark.request({
          method: 'POST',
          uri: '/refresh',
          body: {
            // eslint-disable-next-line camelcase
            refresh_token: token.refresh_token
          }
        })
          .then((res) => res.body);
      }
    },
    storage: {
      boundedAdapter: new StorageAdapterLocalStorage('ciscospark')
    }
  }
});

spark.once('ready', () => {
  if (spark.canAuthorize) {
    document.getElementById('access-token').innerHTML = spark.credentials.supertoken.access_token;
    document.getElementById('refresh-token').innerHTML = spark.credentials.supertoken.refresh_token;

    spark.request({
      uri: 'https://locus-a.wbx2.com/locus/api/v1/ping'
    })
      .then(() => {
        document.getElementById('ping-complete').innerHTML = 'success';
      });
  }
});

// ready class implies js has loaded and selenium can start doing stuff
document.body.classList.add('ready');

document.getElementById('initiate-implicit-grant').addEventListener('click', () => {
  spark.authorization.initiateLogin({
    state: {name: pkg.name}
  });
});

document.getElementById('initiate-authorization-code-grant').addEventListener('click', () => {
  spark.config.credentials.clientType = 'confidential';
  spark.authorization.initiateLogin({
    state: {name: pkg.name}
  });
});

document.getElementById('token-refresh').addEventListener('click', () => {
  document.getElementById('access-token').innerHTML = '';
  spark.refresh({force: true})
    .then(() => {
      document.getElementById('access-token').innerHTML = spark.credentials.supertoken.access_token;
      document.getElementById('refresh-token').innerHTML = spark.credentials.supertoken.refresh_token;
    });
});

document.getElementById('logout').addEventListener('click', () => {
  spark.logout();
});
