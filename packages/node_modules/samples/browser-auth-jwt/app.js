/* eslint-env browser */
/* global ciscospark */
/* eslint-disable camelcase */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */


// Inititate the SDK
const spark = ciscospark.init();
const authenticateButton = document.getElementById('authenticate-button');

spark.once('ready', () => {
  // Now, let's set up the event listener for the Authenticate Button
  document.getElementById('authorization').addEventListener('submit', (event) => {
    // let's make sure we don't reload the page when we submit the form
    event.preventDefault();

    const jwt = document.getElementById('jwt').value;

    authenticateButton.disabled = true;
    // initiate the login sequence if not authenticated.
    spark.authorization.requestAccessTokenFromJwt({jwt}).then(() => {
      if (spark.canAuthorize) {
        // Authorization is successful

        // your app logic goes here

        // Change Authentication status to `Authenticated`
        const authStatus = document.getElementById('authentication-status');
        authStatus.innerHTML = 'Authenticated';
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
