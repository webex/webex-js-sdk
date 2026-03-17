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
const registerBtn = document.querySelector('#register-btn');
const deregisterBtn = document.querySelector('#deregister-btn');
const authStatusElm = document.querySelector('#access-token-status');
const encryptedFileUrlInput = document.querySelector('#encrypted-file-url');
const useFileServiceCheckbox = document.querySelector('#use-file-service');
const encryptedFileJweInput = document.querySelector('#encrypted-file-jwe');
const encryptedFileKeyURIInput = document.querySelector('#encrypted-file-keyURI');
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
    registerBtn.disabled = false;
  });
  e.stopPropagation();
}

credentialsFormElm.addEventListener('submit', initWebex);

encryptedFileUrlInput.addEventListener('input', () => {
  decryptFileResult.innerText = '';
});


async function register(){
  webex.cypher.register().then(() => {
    console.log('Authentication#initWebex() :: Webex Registered');
    authStatusElm.innerText = 'Webex is ready and registered!';
    updateStatus(true);
    registerBtn.disabled = true;
    deregisterBtn.disabled = false;
  }).catch((err) => {
    console.error(`error registering webex: ${err}`);
    authStatusElm.innerText = 'Error registering Webex. Check access token!';
  });
}

async function deregister(){
  webex.cypher.deregister().then(() => {
    console.log('Authentication#initWebex() :: Webex Deregistered');
    authStatusElm.innerText = 'Webex is ready, but not registered!';
    updateStatus(false);
    registerBtn.disabled = false;
    deregisterBtn.disabled = true;
  }).catch((err) => {
    console.error(`error deregistering webex: ${err}`);
    authStatusElm.innerText = 'Error deregistering Webex. Check access token!';
  });
}

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
    let decryptedBuf;
    const options = {
      useFileService: useFileServiceCheckbox.checked,
      jwe: encryptedFileJweInput.value,
      keyUri: encryptedFileKeyURIInput.value,
    };

    decryptedBuf = await webex.cypher.downloadAndDecryptFile(fileUrl, options);
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

// =====================================================
// Upload and Encrypt File Section
// =====================================================

function addEncryptLog(message) {
  const logElm = document.querySelector('#encrypt-log');
  const timestamp = new Date().toLocaleTimeString();
  logElm.textContent = `[${timestamp}] ${message}\n` + logElm.textContent;
}

async function encryptUploadedFile() {
  const kmsKeyUri = document.querySelector('#encrypt-kms-key-uri').value;
  const fileInput = document.querySelector('#encrypt-file-input');
  const jweOutput = document.querySelector('#encrypt-jwe-output');

  addEncryptLog('Starting encryption...');

  if (!kmsKeyUri) {
    addEncryptLog('ERROR: KMS Key URI is required');
    return;
  }

  if (!fileInput.files || fileInput.files.length === 0) {
    addEncryptLog('ERROR: Please select a file to encrypt');
    return;
  }

  const file = fileInput.files[0];
  addEncryptLog(`File selected: ${file.name} (${file.size} bytes, type: ${file.type})`);

  try {
    addEncryptLog('Reading file...');
    const arrayBuffer = await file.arrayBuffer();
    addEncryptLog(`File read successfully (${arrayBuffer.byteLength} bytes)`);

    addEncryptLog('Encrypting with KMS key...');
    const jweString = await webex.internal.encryption.encryptBinaryData(kmsKeyUri, arrayBuffer);
    addEncryptLog('Encryption successful!');

    jweOutput.value = jweString;
    addEncryptLog(`JWE generated (${jweString.length} characters)`);
  } catch (error) {
    console.error('Error encrypting file:', error);
    addEncryptLog(`ERROR: ${error.message || error}`);
    jweOutput.value = '';
  }
}

function copyJweToClipboard() {
  const jweOutput = document.querySelector('#encrypt-jwe-output');
  if (!jweOutput.value) {
    addEncryptLog('No JWE to copy');
    return;
  }

  navigator.clipboard.writeText(jweOutput.value).then(() => {
    addEncryptLog('JWE copied to clipboard!');
  }).catch((err) => {
    addEncryptLog(`Failed to copy: ${err}`);
  });
}

async function generateKeyAndKro() {
  const resourceUriInput = document.querySelector('#new-kro-resource-uri');
  const statusElm = document.querySelector('#generate-key-status');
  const kmsKeyUriInput = document.querySelector('#encrypt-kms-key-uri');

  statusElm.textContent = 'Generating key and KRO...';

  try {
    // Create a new unbound key
    statusElm.textContent = 'Creating unbound key...';
    const key = await webex.internal.encryption.kms.createUnboundKeys({count: 1});
    const unboundKey = key[0];
    statusElm.textContent = `Unbound key created: ${unboundKey.uri}`;

    // If resource URI is provided, create a KRO and bind the key
    if (resourceUriInput.value) {
      statusElm.textContent = 'Creating KRO and binding key...';
      const kro = await webex.internal.encryption.kms.createResource({
        key: unboundKey,
        userIds: []
      });
      statusElm.textContent = `KRO created!\nKey URI: ${unboundKey.uri}\nKRO URI: ${kro.uri}`;
      kmsKeyUriInput.value = unboundKey.uri;
    } else {
      kmsKeyUriInput.value = unboundKey.uri;
      statusElm.textContent = `Key created!\nKey URI: ${unboundKey.uri}\n(No KRO created - resource URI not provided)`;
    }

    addEncryptLog(`Key generated: ${unboundKey.uri}`);
  } catch (error) {
    console.error('Error generating key/KRO:', error);
    statusElm.textContent = `Error: ${error.message || error}`;
  }
}
