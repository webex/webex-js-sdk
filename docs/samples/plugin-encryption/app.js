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
const encryptedFileUrlInput = document.querySelector('#encrypted-file-url');
const decryptFileBtn = document.querySelector('#decrypt-my-file-btn');
const decryptFileResult = document.querySelector('#decrypt-file-result');

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
    decryptFileBtn.disabled = !enabled;
}


async function initWebex(e) {
    e.preventDefault();
    console.log('Authentication#initWebex()');

    tokenElm.disabled = true;
    saveElm.disabled = true;

    decryptFileBtn.disabled = true;
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


async function decryptFile() {
    const fileUrl = encryptedFileUrlInput.value;
    const file = await webex.cypher.downloadAndDecryptFile(
      fileUrl
    );

    window.open(URL.createObjectURL(file));
    decryptFileResult.innerText = 'success';
}
