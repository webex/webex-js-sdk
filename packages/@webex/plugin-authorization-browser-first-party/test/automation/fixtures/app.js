/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser */

import '@babel/polyfill';
import '@webex/plugin-authorization-browser-first-party';
import StorageAdapterLocalStorage from '@webex/storage-adapter-local-storage';
import WebexCore from '@webex/webex-core';

import pkg from '../../../package';

const webex = window.webex = new WebexCore({
  config: {
    storage: {
      boundedAdapter: new StorageAdapterLocalStorage('webex')
    }
  }
});

webex.once('ready', () => {
  if (webex.canAuthorize) {
    document.getElementById('access-token').innerHTML = webex.credentials.supertoken.access_token;
    document.getElementById('refresh-token').innerHTML = webex.credentials.supertoken.refresh_token;

    webex.request({
      uri: 'https://locus-a.wbx2.com/locus/api/v1/ping'
    })
      .then(() => {
        document.getElementById('ping-complete').innerHTML = 'success';
      });
  }
});

// ready class implies js has loaded and selenium can start doing stuff
document.body.classList.add('ready');

document.getElementById('initiate-authorization-code-grant').addEventListener('click', () => {
  webex.config.credentials.clientType = 'confidential';
  webex.authorization.initiateLogin({
    state: {
      exchange: false,
      name: pkg.name
    }
  });
});

document.getElementById('token-refresh').addEventListener('click', () => {
  document.getElementById('access-token').innerHTML = '';
  webex.refresh({force: true})
    .then(() => {
      document.getElementById('access-token').innerHTML = webex.credentials.supertoken.access_token;
      document.getElementById('refresh-token').innerHTML = webex.credentials.supertoken.refresh_token;
    });
});

document.getElementById('logout').addEventListener('click', () => {
  webex.logout();
});
