/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser */
/* eslint camelcase: [0] */
/* eslint no-alert: [0] */
'use strict';

// Take a look at spark.js for steps to initalize the SDK and hook it into
// localStorage.
var spark = window.spark = require('./spark');

spark.on('change:credentials', function() {
  if (spark.credentials.authorization) {
    document.getElementById('access-token').innerHTML = spark.credentials.authorization.access_token;
  }
});

// By this point, we've either loaded credentials from localStorage or the
// address bar, so `isAuthenticated` won't change without user interaction.
if (spark.isAuthenticated) {
  document.getElementById('access-token').innerHTML = spark.credentials.authorization.access_token;

  // Even though we're authenticated, we need to call `authenticate()` to make
  // sure we've registered or refreshed our WDM registration.
  spark.authenticate()
    // Connect to mercury. Not actually needed for this example, but here for
    // illustration purposes.
    .then(spark.mercury.listen.bind(spark.mercury))
    .then(function() {
      showSectionUserInfo();
      showSectionBasicDemo();
      showSectionLogout();
    })
    .catch(function(reason) {
      console.error(reason);
      alert(reason);
    });
}
else {
  showSectionUserType();
}

document.getElementById('button-new-user').addEventListener('click', function() {
  hideSectionLogin();
  showSectionSignUp();
});

document.getElementById('button-existing-user').addEventListener('click', function() {
  hideSectionSignUp();
  showSectionLogin();
});

document.getElementById('form-user-verify').addEventListener('submit', function(event) {
  event.preventDefault();
  spark.user.register({email: event.target.elements.email.value})
    .then(function(res) {
      document.getElementById('eqp').innerHTML = res.eqp;
      showRowActivate();
    })
    .catch(function(reason) {
      console.error(reason);
      alert(reason);
    });
});

document.getElementById('form-user-activate').addEventListener('submit', function(event) {
  event.preventDefault();
  spark.user.activate({encryptedQueryString: event.target.elements.eqp.value})
    .then(function() {
      document.getElementById('activated').innerHTML = 'Activated!';
    });
});

document.getElementById('button-implicit-login').addEventListener('click', function() {
  // The next line is a hack to ensure we can do this demo and shouldn't be
  // user in your app. You should set `clientType` when initializing `Spark`.
  spark.config.credentials.clientType = 'public';
  spark.authenticate()
    .catch(function(reason) {
      console.error(reason);
    });
});

document.getElementById('button-passport-login').addEventListener('click', function() {
  // The next line is a hack to ensure we can do this demo and shouldn't be
  // user in your app. You should set `clientType` when initializing `Spark`.
  spark.config.credentials.clientType = 'confidential';
  spark.authenticate({state: {
    passport: true
  }})
    .catch(function(reason) {
      console.error(reason);
    });
});

document.getElementById('button-refresh-token-passport').addEventListener('click', function() {
  document.getElementById('access-token').innerHTML = '';
  spark.credentials.refresh({force: true});
});

document.getElementById('button-get-me').addEventListener('click', function() {
  spark.user.get()
    .then(function(me) {
      document.getElementById('me').innerHTML = JSON.stringify(me, null, 2);
    });
});

document.getElementById('button-get-shells').addEventListener('click', function() {
  spark.conversation.get({
    activitiesLimit: 0,
    conversationsLimit: 20,
    ackFilter: 'noack'
  })
    .then(function(shells) {
      document.getElementById('shells').innerHTML = JSON.stringify(shells, null, 2);
    });
});

document.getElementById('button-implicit-logout').addEventListener('click', function() {
  // The next line is a hack to ensure we can do this demo and shouldn't be
  // user in your app. You should set `clientType` when initializing `Spark`.
  spark.config.credentials.clientType = 'public';
  localStorage.clear();
  spark.logout()
    .catch(function(reason) {
      console.error(reason);
    });
});

document.getElementById('button-passport-logout').addEventListener('click', function() {
  // The next line is a hack to ensure we can do this demo and shouldn't be
  // user in your app. You should set `clientType` when initializing `Spark`.
  spark.config.credentials.clientType = 'confidential';
  localStorage.clear();
  spark.logout()
    .catch(function(reason) {
      console.error(reason);
      alert(reason);
    });
});

document.body.classList.add('ready');

function showSectionUserType() {
  document.getElementById('section-user-type').classList.remove('hidden');
}

function showSectionSignUp() {
  document.getElementById('section-sign-up').classList.remove('hidden');
}

function showRowActivate() {
  document.getElementById('row-activate').classList.remove('hidden');
}

function showSectionLogin() {
  document.getElementById('section-login').classList.remove('hidden');
}

function showSectionUserInfo() {
  document.getElementById('user-id').innerHTML = spark.device.userId;
  document.getElementById('section-user-info').classList.remove('hidden');
}

function showSectionBasicDemo() {
  document.getElementById('section-basic-demo').classList.remove('hidden');
}

function showSectionLogout() {
  document.getElementById('section-logout').classList.remove('hidden');
}

function hideSectionSignUp() {
  document.getElementById('section-sign-up').classList.add('hidden');
}

function hideSectionLogin() {
  document.getElementById('section-login').classList.add('hidden');
}
