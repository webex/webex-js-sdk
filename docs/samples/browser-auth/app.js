/* eslint-env browser */
/* global Webex */
/* eslint-disable camelcase */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */
/* eslint-disable max-len */


let webex;

function initializeImplicitAuth() {
  // This is one way you might programattically determine your redirect_uri
  // depending on where you've deployed your app, but you're probably better off
  // having development/staging/production builds and injecting directly from the
  // environment.
  let redirect_uri = `${window.location.protocol}//${window.location.host}`;

  if (window.location.pathname) {
    redirect_uri += window.location.pathname;
  }

  const fedRampInput = document.querySelector('#enable-fedramp');

  fedRampInput.checked = localStorage.getItem('fedRampEnabled');
  fedRampInput.addEventListener('change', (event) => {
    localStorage.setItem('fedRampEnabled', event.target.checked);
  });

  // Inititate the SDK
  // IN A PRODUCTION APP YOU SHOULD NOT HARDCODE THESE VALUES BUT INSTEAD LOAD
  // THEM FROM THE ENVIRONMENT AT BUILD TIME. SECRETS AND OTHER CREDENTIALS SHOULD
  // NOT BE COMMITTED TO THE CODEBASE.
  // eslint-disable-next-line no-multi-assign
  webex = window.webex = Webex.init({
    config: {
      fedramp: fedRampInput.checked,
      credentials: {
        client_id: 'C7c3f1143a552d88d40b2afff87600c366c830850231597fb6c1c1e28a5110a4f',
        redirect_uri,
        scope: 'spark:all spark:kms'
      }
    }
  });

  webex.once('ready', () => {
    // Now, let's set up the event listener for the Authenticate Button
    document.getElementById('implicit-authorization').addEventListener('submit', (event) => {
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
      const authStatus = document.getElementById('implicit-authentication-status');

      authStatus.innerText = 'Authenticated';
      authStatus.style = 'color: green';
    }
  });
}

function initializeJwtAuth() {
  // eslint-disable-next-line no-multi-assign
  webex = window.webex = Webex.init();


  webex.once('ready', () => {
    const jwtAuthenticateButton = document.getElementById('jwt-authenticate-button');

    // Now, let's set up the event listener for the Authenticate Button
    document.getElementById('jwt-authorization').addEventListener('submit', (event) => {
      // let's make sure we don't reload the page when we submit the form
      event.preventDefault();

      const jwtPayload = {
        issuer: document.getElementById('issuer').value,
        secretId: document.getElementById('secret').value,
        displayName: document.getElementById('name').value,
        expiresIn: "12h"
      };

      jwtAuthenticateButton.disabled = true;
      // initiate the login sequence if not authenticated.
      webex.authorization.createJwt(jwtPayload)
        .then(({jwt}) => {
          webex.authorization.requestAccessTokenFromJwt({jwt})
            .then(() => {
              if (webex.canAuthorize) {
                // Authorization is successful

                // your app logic goes here

                // Change Authentication status to `Authenticated`
                const authStatus = document.getElementById('jwt-authentication-status');

                authStatus.innerText = 'Authenticated';
                authStatus.style = 'color: green';
              }
            })
        })
        .catch((e) => {
          // Do something with the auth error here
          console.error(e);
          jwtAuthenticateButton.disabled = false;
        });
    });
  });
}

function displayImplicitAuthForm() {
  document.getElementById('jwt-authentication-section').style.display = 'none';
  document.getElementById('implicit-authentication-section').style.display = 'block';

  initializeImplicitAuth();
}

function displayGuestAuthForm() {
  document.getElementById('implicit-authentication-section').style.display = 'none';
  document.getElementById('jwt-authentication-section').style.display = 'block';

  initializeJwtAuth();
}

function handleAuthTypeChange() {
  // Checks which radio is selected
  const isImplicitAuth = document.getElementById('implicit-radio').checked;
  const isGuestAuth = document.getElementById('jwt-radio').checked;

  // We would like to add the correct form based on the selected radio
  if (isImplicitAuth) {
    displayImplicitAuthForm();
  }

  if (isGuestAuth) {
    displayGuestAuthForm();
  }
}

handleAuthTypeChange();
