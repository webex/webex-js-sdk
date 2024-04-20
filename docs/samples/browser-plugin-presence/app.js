/* eslint-env browser */

/* global Webex */

/* eslint-disable no-console */
/* eslint-disable require-jsdoc */

// Declare some globals that we'll need throughout.
let webex;
let enableProd = true;

const credentialsFormElm = document.querySelector('#credentials');
const tokenElm = document.querySelector('#access-token');
const saveElm = document.querySelector('#access-token-save');
const authStatusElm = document.querySelector('#access-token-status');
const selfPresenceElm = document.querySelector('#self-presence-status');
const setPresenceStatusElm = document.querySelector('#set-presence');
const getUserPresenceElm = document.querySelector('#get-user-presence');
const userPresenceStatusElm = document.querySelector('#user-presence-status');
const presenceNotifications = document.querySelector('#subscribe-presence-notifications');
const subscribeUserIds = document.querySelector('#subscribe-id');
const subscribeNotificationBox = document.querySelector('#subscribe-presence-notifications');

// Store and Grab `access-token` from localstorage
if (localStorage.getItem('date') > new Date().getTime()) {
    tokenElm.value = localStorage.getItem('access-token');
} else {
    localStorage.removeItem('access-token');
}

tokenElm.addEventListener('change', (event) => {
    localStorage.setItem('access-token', event.target.value);
    localStorage.setItem('date', new Date().getTime() + 12 * 60 * 60 * 1000);
});

function changeEnv() {
    enableProd = !enableProd;
    enableProduction.innerHTML = enableProd ? 'In Production' : 'In Integration';
}


async function initWebex(e) {
    e.preventDefault();
    console.log('Authentication#initWebex()');
  
    tokenElm.disabled = true;
    saveElm.disabled = true;
    authStatusElm.innerText = 'initializing...';
  
    const webexConfig = {
      config: {
        logger: {
          level: 'debug', // set the desired log level
        },
        meetings: {
          reconnection: {
            enabled: true,
          },
          enableRtx: true,
        },
        encryption: {
          kmsInitialTimeout: 8000,
          kmsMaxTimeout: 40000,
          batcherMaxCalls: 30,
          caroots: null,
        },
        dss: {},
      },
      credentials: {
        access_token: tokenElm.value
      }
    };
  
    if (!enableProd) {
      webexConfig.config.services = {
        discovery: {
          u2c: 'https://u2c-intb.ciscospark.com/u2c/api/v1',
          hydra: 'https://apialpha.ciscospark.com/v1/',
        },
      };
    }
  
    webex = window.webex = Webex.init(webexConfig);

    webex.once('ready', () => {
        console.log('Authentication#initWebex() :: Webex Ready');
        authStatusElm.innerText = 'Webex is ready. Saved access token!';
    });
}
  
credentialsFormElm.addEventListener('submit', initWebex);
  

function getSelfPresence() {
    console.log('Presence enabled: ', webex.presence.isEnabled());
    webex.presence.get(webex.internal.device.userId)
        .then((res) => {
            selfPresenceElm.innerText = JSON.stringify(res, null, 2);
        })
        .catch((error) => {
            console.log('Error while fetching self presence status', error);
            selfPresenceElm.innerText = 'Error while fetching self presence status';
        });
}

function setSelfPresence() {
    const status = setPresenceStatusElm.value;
    webex.presence.setStatus(status)
        .then(() => {
            console.log('Set status for the user successfully');
        })
        .catch((error) => {
            console.log('Error occurred while setting user\'s status', error);
        })
}

function getUserPresence() {
    const userId = getUserPresenceElm.value;
    webex.presence.get(userId)
        .then((response) => {
                userPresenceStatusElm.innerText = JSON.stringify(response, null, 2);
            })
        .catch((error) => {
            console.log('Error occurrec while trying to get user\'s presence', error);
        })
}

function handlePresenceUpdate(payload) {
    let value = subscribeNotificationBox.innerText;
    value += '\n\n';
    value += JSON.stringify(payload.data, null, 2);
    subscribeNotificationBox.innerText = value;
}

function startPresenceListener() {
    webex.internal.mercury.on('event:apheleia.subscription_update', handlePresenceUpdate);
}

function subscribePresence() {
    const ids = subscribeUserIds.value.split(',');
    startPresenceListener();
    webex.presence.subscribe(ids)
        .then(() => {
            console.log('successfully subscribed');
        })
        .catch((error) => {
            console.log('encountered error while subscribing', error);
        })
}

function unsubscribePresence() {
    const ids = subscribeUserIds.value.split(',');
    webex.presence.unsubscribe(ids)
        .then(() => {
            console.log('successfully unsubscribed');
        })
        .catch((error) => {
            console.log('encountered error while unsubscribing', error);
        })
}
