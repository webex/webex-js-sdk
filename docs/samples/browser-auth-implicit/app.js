/* eslint-env browser */
/* global Webex */
/* eslint-disable camelcase */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */


// This is one way you might programattically determine your redirect_uri
// depending on where you've deployed your app, but you're probably better off
// having development/staging/production builds and injecting directly from the
// environment.
let redirect_uri = `${window.location.protocol}//${window.location.host}`;

if (window.location.pathname) {
  redirect_uri += window.location.pathname;
}

// Inititate the SDK
// IN A PRODUCTION APP YOU SHOULD NOT HARDCODE THESE VALUES BUT INSTEAD LOAD
// THEM FROM THE ENVIRONMENT AT BUILD TIME. SECRETS AND OTHER CREDENTIALS SHOULD
// NOT BE COMMITTED TO THE CODEBASE.
// eslint-disable-next-line no-multi-assign
const webex = window.webex = Webex.init({
  config: {
    credentials: {
      client_id: 'C7c3f1143a552d88d40b2afff87600c366c830850231597fb6c1c1e28a5110a4f',
      redirect_uri,
      scope: 'spark:all spark:kms'
    }
  }
});

webex.once('ready', () => {
  // Now, let's set up the event listener for the Authenticate Button
  document.getElementById('authorization').addEventListener('submit', (event) => {
    // let's make sure we don't reload the page when we submit the form
    event.preventDefault();

    // initiate the login sequence if not authenticated.
    webex.authorization.initiateLogin();
  });

  // Now, let's set up the event listener for the Authenticate Button
  document.getElementById('logout').addEventListener('submit', (event) => {
    // let's make sure we don't reload the page when we submit the form
    event.preventDefault();

    if (webex.canAuthorize) {
      // if already authenticated, logout on click
      webex.logout();
    }
    else {
      // No user is authenticated
      console.log('cannot logout when no user is authenticated');
    }
  });

  if (webex.canAuthorize) {
    // Authorization is successful

    // your app logic goes here

    // Change Authentication status to `Authenticated`
    const authStatus = document.getElementById('authentication-status');

    authStatus.innerText = 'Authenticated';
    authStatus.style = 'color: green';
  }
});
