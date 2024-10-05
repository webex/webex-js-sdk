/* eslint-env browser */

/* global Webex */

/* eslint-disable no-console */
/* eslint-disable require-jsdoc */

// Declare some globals that we'll need throughout.
let webex;
let enableProd = true;
let subscribedUserIds = [];

const credentialsFormElm = document.querySelector('#credentials');
const tokenElm = document.querySelector('#access-token');
const saveElm = document.querySelector('#access-token-save');
const authStatusElm = document.querySelector('#access-token-status');
const selfPresenceElm = document.querySelector('#self-presence-status');
const selfPresenceBtn = document.querySelector('#sd-get-self-presence');
const setPresenceStatusElm = document.querySelector('#set-presence');
const setPresenceTtl = document.querySelector('#presence-ttl');
const setPresenceBtn = document.querySelector('#sd-set-self-presence');
const getPresenceBtn = document.querySelector('#sd-get-user-presence');
const getUserPresenceElm = document.querySelector('#get-user-presence');
const userPresenceStatusElm = document.querySelector('#user-presence-status');
const presenceNotifications = document.querySelector('#subscribe-presence-notifications');
const usersToSubOrUnsub = document.querySelector('#subscribe-id');
const subscribePresenceBtn = document.querySelector('#subscribe-presence');
const unsubscribePresenceBtn = document.querySelector('#unsubscribe-presence');
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

function updateStatus(enabled) {
    selfPresenceBtn.disabled = !enabled;
    setPresenceBtn.disabled = !enabled;
    getPresenceBtn.disabled = !enabled;
    subscribePresenceBtn.disabled = !enabled;
    unsubscribePresenceBtn.disabled = !enabled;
}


async function initWebex(e) {
    e.preventDefault();
    console.log('Authentication#initWebex()');
  
    tokenElm.disabled = true;
    saveElm.disabled = true;
    selfPresenceBtn.disabled = true;
    setPresenceBtn.disabled = true;
    getPresenceBtn.disabled = true;
    subscribePresenceBtn.disabled = true;
    unsubscribePresenceBtn.disabled = true;

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

    webex.messages.listen()
        .then(() => {
          updateStatus(true);
         })
        .catch((err) => {
          console.error(`error listening to messages: ${err}`);
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
    const ttl = setPresenceTtl.value;
    webex.presence.setStatus(status, ttl)
        .then(() => {
            console.log('Set status for the user successfully');
        })
        .catch((error) => {
            console.log('Error occurred while setting user\'s status', error);
        })
}

function getUserPresence() {
    const userId = getUserPresenceElm.value.trim();
    webex.presence.get(userId)
        .then((response) => {
                userPresenceStatusElm.innerText = JSON.stringify(response, null, 2);
            })
        .catch((error) => {
            console.log('Error occurred while trying to get user\'s presence', error);
        })
}

function handlePresenceUpdate(payload) {
    let value = subscribeNotificationBox.innerText;
    value += '\n\n';
    value += JSON.stringify(payload.data, null, 2);
    subscribeNotificationBox.innerText = value;
}

function setupPresenceListener() {
    webex.internal.mercury.on('event:apheleia.subscription_update', handlePresenceUpdate);
}

function removePresenceListener() {
    webex.internal.mercury.off('event:apheleia.subscription_update', handlePresenceUpdate);
}

function subscribePresence() {
    const ids = usersToSubOrUnsub.value.trim().split(',');
    if (subscribedUserIds.length == 0) {
        setupPresenceListener();
    }
    webex.presence.subscribe(ids)
        .then(() => {
            console.log('successfully subscribed');
            ids.map((id) => subscribedUserIds.push(id));
        })
        .catch((error) => {
            console.log('encountered error while subscribing', error);
        })
}

function removeFromArray(A, B) {
    return A.filter(element => !B.includes(element));
}

function unsubscribePresence() {
    const ids = usersToSubOrUnsub.value.trim().split(',');
    if (subscribedUserIds.length == 0) {
        removePresenceListener();
    }
    webex.presence.unsubscribe(ids)
        .then(() => {
            console.log('successfully unsubscribed');
            subscribedUserIds = removeFromArray(subscribedUserIds, ids);
        })
        .catch((error) => {
            console.log('encountered error while unsubscribing', error);
        })
}
