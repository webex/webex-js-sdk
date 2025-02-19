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
const decryptedFileNameInput = document.querySelector('#decrypted-file-name');
const decryptFileBtn = document.querySelector('#decrypt-my-file-btn');
const decryptFileResult = document.querySelector('#decrypt-file-result');
const mimeTypeDropdown = document.querySelector('#mime-types');

// Store and Grab `access-token` from localstorage
if (localStorage.getItem('date') > new Date().getTime()) {
  tokenElm.value = localStorage.getItem('access-token');
} else {
  localStorage.removeItem('access-token');
}

tokenElm.addEventListener('change', (event) => {
  const token = event.target.value;
  if (!token) {
    localStorage.removeItem('access-token');
    localStorage.removeItem('date');
    return;
  }
  localStorage.setItem('access-token', event.target.value);
  localStorage.setItem('date', new Date().getTime() + 12 * 60 * 60 * 1000);
});

function changeEnv() {
  enableProd = !enableProd;
  enableProduction.innerHTML = enableProd ? 'In Production' : 'In Integration';
}

function updateStatus(enabled) {
  decryptFileResult.innerText = '';
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
    },
    credentials: {
      access_token: tokenElm.value
    }
  };

  if (!enableProd) {
    webexConfig.config.services = {
      discovery: {
        u2c: 'https://u2c-intb.ciscospark.com/u2c/api/v1',
        hydra: 'https://hydra-intb.ciscospark.com/v1/',
      },
    };
  }

  webex = window.webex = Webex.init(webexConfig);

  webex.once('ready', () => {
    console.log('Authentication#initWebex() :: Webex Ready');
    authStatusElm.innerText = 'Webex is ready. Saved access token!';

    webex.cypher.register().then(() => {
      console.log('Authentication#initWebex() :: Webex Registered');
      updateStatus(true);
    }).catch((err) => {
      console.error(`error registering webex: ${err}`);
      authStatusElm.innerText = 'Error registering Webex. Check access token!';
    });
  });
  e.stopPropagation();
}

credentialsFormElm.addEventListener('submit', initWebex);

encryptedFileUrlInput.addEventListener('input', () => {
  decryptFileResult.innerText = '';
});

async function decryptFile() {
  decryptFileResult.innerText = '';
  const fileUrl = encryptedFileUrlInput.value;
  const encryptedFileName = decryptedFileNameInput.value;
  const mimeType = mimeTypeDropdown.value;

  if (!fileUrl) {
    decryptFileResult.innerText = ': error - Invalid file URL';
    return;
  }

  if (!mimeType) {
    decryptFileResult.innerText = ': error - Invalid MIME type';
    return;
  }

  let objectUrl;
  try {
    const decryptedBuf = await webex.cypher.downloadAndDecryptFile(fileUrl);
    const file = new File([decryptedBuf], encryptedFileName, {type: mimeType});
    objectUrl = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = file.name || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    decryptFileResult.innerText = ': success';
  }
  catch (error) {
    console.error('error decrypting file', error);
    decryptFileResult.innerText = ': error';
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
