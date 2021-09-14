/* eslint-env browser */
/* global Webex */
/* eslint-disable camelcase */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */


// Inititate the SDK
// eslint-disable-next-line no-multi-assign
const webex = window.webex = Webex.init();
const authenticateButton = document.getElementById('authenticate-button');

webex.once('ready', () => {
  // Now, let's set up the event listener for the Authenticate Button
  document.getElementById('authorization').addEventListener('submit', (event) => {
    // let's make sure we don't reload the page when we submit the form
    event.preventDefault();

    const jwt = document.getElementById('jwt').value;

    authenticateButton.disabled = true;
    // initiate the login sequence if not authenticated.
    webex.authorization.requestAccessTokenFromJwt({jwt}).then(() => {
      if (webex.canAuthorize) {
        // Authorization is successful

        // your app logic goes here

        // Change Authentication status to `Authenticated`
        const authStatus = document.getElementById('authentication-status');

        authStatus.innerText = 'Authenticated';
        authStatus.style = 'color: green';
      }
    })
      .catch((e) => {
        // Do something with the auth error here
        console.error(e);
        authenticateButton.disabled = false;
      });
  });
});
