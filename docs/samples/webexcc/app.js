/* eslint-disable no-underscore-dangle */
/* eslint-env browser */

/* global Webex */
/* global Calling */

/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-global-assign */
/* eslint-disable no-multi-assign */
/* eslint-disable max-len */

// Globals
let calling;
let webex;
let sdk;
let agentDeviceType;
let deviceId;

const authTypeElm = document.querySelector('#auth-type');
const credentialsFormElm = document.querySelector('#credentials');
const tokenElm = document.querySelector('#access-token');
const saveElm = document.querySelector('#access-token-save');
const authStatusElm = document.querySelector('#access-token-status');
const oauthFormElm = document.querySelector('#oauth');
const oauthLoginElm = document.querySelector('#oauth-login-btn');
const oauthStatusElm = document.querySelector('#oauth-status');
// const registerElm = document.querySelector('#registration-register');
// const unregisterElm = document.querySelector('#registration-unregister');
const registrationStatusElm = document.querySelector('#registration-status');
const integrationEnv = document.getElementById('integration-env');
const fetchTeamsButton = document.querySelector('#fetchTeams');
const teamsDropdown = document.querySelector('#teamsDropdown');
const statusDropdown = document.querySelector('#statusDropdown');
const agentLoginButton = document.querySelector('#loginAgent');
const agentLogoutButton = document.querySelector('#logoutAgent');
const setAgentStatusButton = document.querySelector('#setAgentStatus');
const answerElm = document.querySelector('#answer');
const holdResumeElm = document.querySelector('#hold-resume');
const consultElm = document.querySelector('#consult');
const transferElm = document.querySelector('#transfer');
const recordingElm = document.querySelector('#recording');
const wrapupElm = document.querySelector('#wrapup');

// Store and Grab `access-token` from localstorage
if (localStorage.getItem('date') > new Date().getTime()) {
  tokenElm.value = localStorage.getItem('access-token');
}
else {
  localStorage.removeItem('access-token');
}

tokenElm.addEventListener('change', (event) => {
  localStorage.setItem('access-token', event.target.value);
  localStorage.setItem('date', new Date().getTime() + (12 * 60 * 60 * 1000));
});

function changeAuthType() {
  switch (authTypeElm.value) {
    case 'accessToken':
      toggleDisplay('credentials', true);
      toggleDisplay('oauth', false);
      break;
    case 'oauth':
      initOauth();
      toggleDisplay('credentials', false);
      toggleDisplay('oauth', true);
      break;
    default:
      break;
  }
}

function toggleDisplay(elementId, status) {
  const element = document.getElementById(elementId);

  if (status) {
    element.classList.remove('hidden');
  }
  else {
    element.classList.add('hidden');
  }
}

function generateWebexConfig({credentials}) {
  return {
    appName: 'sdk-samples',
    appPlatform: 'testClient',
    fedramp: false,
    logger: {
      level: 'log'
    },
    ...(integrationEnv.checked && {
      services: {
        discovery: {
          u2c: 'https://u2c-intb.ciscospark.com/u2c/api/v1',
          hydra: 'https://apialpha.ciscospark.com/v1/'
        }
      }
    }),
    credentials,
    // Any other sdk config we need
  };
}

function initOauth() {
  let redirectUri = `${window.location.protocol}//${window.location.host}`;

  if (window.location.pathname) {
    redirectUri += window.location.pathname;
  }

  webex = window.webex = Webex.init({
    config: generateWebexConfig({
      credentials: {
        client_id: 'C669818c012a7ba241cb160d4dae40a897a9a32fdc78fbdb0b66db051173b1671',
        redirect_uri: redirectUri,
        scope: 'spark:all spark:kms cjp:config cjp:config_write cjp:config_read spark:people_read spark:webrtc_calling cjp:user cloud-contact-center:pod_conv cloud-contact-center:pod_read cjds:admin_org_read cjds:admin_org_write',  // Adjust scopes as needed
      }
    })
  });

  localStorage.setItem('OAuth', true);

  webex.once('ready', () => {
    oauthFormElm.addEventListener('submit', (event) => {
      event.preventDefault();
      // initiate the login sequence if not authenticated.
      webex.authorization.initiateLogin();
    });

    if (webex.canAuthorize) {
      oauthStatusElm.innerText = 'Authenticated';
    }
  });
}

// SPARK-499535
if(localStorage.getItem('OAuth')) {
  setTimeout(() => {
    initOauth();
    localStorage.removeItem('OAuth');
  }, 500);
}

function initWebex(e) {
  e.preventDefault();
  console.log('Authentication#initWebex()');

  integrationEnv.disabled = true;
  tokenElm.disabled = true;
  saveElm.disabled = true;
  authStatusElm.innerText = 'initializing...';

  const webexConfig = generateWebexConfig({})
  const callingConfig = {
    clientConfig: {
      calling: true,
      contact: false,
      callHistory: false,
      callSettings: false,
      voicemail: false,
    },
    callingClientConfig: {
      logger: {
        level: 'info'
      },
      discovery: {},
      serviceData: {
        indicator: 'contactcenter',
        domain: 'test.example.com'
      }   
    },
    logger: {
      level: 'info'
    }
  }

  webex = window.webex = Webex.init({
    config: webexConfig,
    credentials: {
      access_token: tokenElm.value
    }
  });

  webex.once('ready', async () => {
    console.log('Authentication#initWebex() :: Webex Ready');
    // registerElm.disabled = false;
    authStatusElm.innerText = 'Saved access token!';
    // calling = await Calling.init({webex, webexConfig, callingConfig});

    // calling.register().then(async () => {
      sdk = Webex.getWebexCCSDK(webex);
      // registerElm.classList.add('btn--green');
    // });
  });

  return false;
}
credentialsFormElm.addEventListener('submit', initWebex);


// function register() {
//   console.log('Authentication#register()');
//   registerElm.disabled = true;
//   unregisterElm.disabled = true;
//   registrationStatusElm.innerText = 'Registering...';

//   sdk.register()
//     .then(() => {
//       console.log('Authentication#register() :: successfully registered');
//       unregisterElm.disabled = false;
//       unregisterElm.classList.add('btn--red');
//       fetchTeamsButton.style.display = 'block';
//     })
//     .catch((error) => {
//       console.warn('Authentication#register() :: error registering', error);
//       registerElm.disabled = false;
//     })
//     .finally(() => {
//       registrationStatusElm.innerText = sdk.isRegistred() ?
//         'Registered' :
//         'Not Registered';
//     });
// }

// function unregister() {
//   console.log('Authentication#unregister()');
//   registerElm.disabled = true;
//   unregisterElm.disabled = true;
//   registrationStatusElm.innerText = 'Unregistering...';

//   sdk.unregister()
//     .then(() => {
//       console.log('Authentication#register() :: successfully unregistered');
//       registerElm.disabled = false;
//     })
//     .catch((error) => {
//       console.warn('Authentication#register() :: error unregistering', error);
//       unregisterElm.disabled = false;
//     })
//     .finally(() => {
//       registrationStatusElm.innerText = sdk.isRegistred() ?
//         'Registered' :
//         'Not Registered';
//     });
// }

// Separate logic for Safari enables video playback after previously
// setting the srcObject to null regardless if autoplay is set.
window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  const meetingSdk = document.createElement('script');
  meetingSdk.type = 'text/javascript';
  if(params.get('meetings') !== null){
    meetingSdk.src = '../meetings.min.js';
  }
  else{
    meetingSdk.src = '../webex.min.js';
  }
  document.body.appendChild(meetingSdk);
};

const allCollapsibleElements = document.querySelectorAll('.collapsible');
allCollapsibleElements.forEach((el) => {
  el.addEventListener('click', (event) => {
    const {parentElement} = event.currentTarget;

    const sectionContentElement = parentElement.querySelector('.section-content');
    const arrowIcon = parentElement.querySelector('.arrow');

    sectionContentElement.classList.toggle('collapsed');
    arrowIcon.classList.contains('fa-angle-down') ? arrowIcon.classList.replace('fa-angle-down', 'fa-angle-up') : arrowIcon.classList.replace('fa-angle-up', 'fa-angle-down');

    if(el.innerText !== 'Auth & Registration' && !sectionContentElement.classList.contains('collapsed')) {
      // Note: Index of the Auth & Registration section may change if further re-ordering is done
      allCollapsibleElements[1].parentElement.querySelector('.section-content').classList.add('collapsed');
      allCollapsibleElements[1].parentElement.querySelector('.arrow').classList.replace('fa-angle-down', 'fa-angle-up');
    }
  });
});

// Get Access Token from URL and put in access token field
if (window.location.hash) {
  // hacky way to get access token from hash
  const urlParams = new URLSearchParams(window.location.hash.replace('#', '?'));

  const accessToken = urlParams.get('access_token');
  const expiresIn = urlParams.get('expires_in');

  if (accessToken) {
    localStorage.setItem('access-token', accessToken);
    localStorage.setItem('date', new Date().getTime() + parseInt(expiresIn, 10));
    tokenElm.value = accessToken;
  }
}

const allSectionContentElements = document.querySelectorAll('.section-content');
const allArrowElements = document.querySelectorAll('.arrow');

function collapseAll() {
  allSectionContentElements.forEach((el) => {
    el.classList.add('collapsed');
  });

  allArrowElements.forEach((el) => {
    el.classList.replace('fa-angle-down', 'fa-angle-up');
  });
}

function expandAll() {
  allSectionContentElements.forEach((el) => {
    el.classList.remove('collapsed');
  });

  allArrowElements.forEach((el) => {
    el.classList.replace('fa-angle-up', 'fa-angle-down');
  });
}

async function handleAgentLogin(e) {
  const value = e.target.value;
  if (value === 'Desktop') {
    agentDeviceType = 'BROWSER';
    deviceId = 'webrtc-6b310dff-569e-4ac7-b064-70f834ea56d8'
  } else {
    agentDeviceType = 'EXTENSION';
    deviceId = '1001'
  }
  agentLoginButton.disabled = false;
}


function loginAgentWithSelectedTeam() {
  sdk.loginAgentWithSelectedTeam(teamsDropdown.value, agentDeviceType, deviceId);
}

function logoutAgent() {
  sdk.logoutAgent('logout through SDK');
}

function setAgentStatus() {
  sdk.changeAgentState(statusDropdown.options[statusDropdown.selectedIndex].dataset.status, statusDropdown.value, '', 'my reason');
}

function getTeams() {
  // Fetch teams for the specified organization
  sdk.getTeams()
      .then((teamsData) => {
          teamsDropdown.innerHTML = ''; // Clear existing options    

          teamsData.forEach((team) => { 
              // add condition to check if team type is 'AGENT' and add to dropdown
              if (team.teamType === 'AGENT') {
                const option = document.createElement('option');
                option.value = team.id;
                option.text = team.name;
                teamsDropdown.add(option);
              }
          });

          sdk.listAuxiliaryCodes()
              .then((auxData) => {
                  statusDropdown.style.display = 'block';
                  statusDropdown.innerHTML = ''; // Clear existing options
                  setAgentStatusButton.style.display = 'block';
                  const option = document.createElement('option');
                  option.value = '0';
                  option.text = 'Available';
                  option.setAttribute('data-status','Available'); // Add data to the
                  statusDropdown.add(option);
                  auxData.data.forEach((auxCode) => {
                      const option = document.createElement('option');
                      option.value = auxCode.id;
                      option.text = auxCode.name;
                      option.setAttribute('data-status', 'Idle'); // Add data to the
                      if (auxCode.active && !auxCode.isSystemCode)
                      {
                          statusDropdown.add(option);
                      }
                  });
              })
              .catch((error) => {
                  console.error('Error fetching teams:', error);
            });
      })
      .catch((error) => {
          console.error('Error fetching teams:', error);
      }); 
}

window.addEventListener('line:incoming_call', (event) => {
  console.log('Received incoming webrtc call: ', event.detail.call);
  answerElm.disabled = false;
})

window.addEventListener('enable-controls', (event) => {
  console.log('Agent is on call for logintype: ', event.detail.deviceType);
  holdResumeElm.disabled = false;
  consultElm.disabled = false;
  transferElm.disabled = false;
  recordingElm.disabled = false;
  wrapupElm.disabled = false
})

function holdResume() {
  if (holdResumeElm.innerText === 'Hold') {
    sdk.holdTask();
    holdResumeElm.innerText = 'Resume';
  } else {
    sdk.resumeTask();
    holdResumeElm.innerText = 'Hold';
  }
}

function consult() {
  if (consultElm.innerText === 'Consult') {
    sdk.consultTask('agent');
    holdResumeElm.innerText = 'Resume';
    consultElm.innerText = 'End Consult'
  } else {
    sdk.consultEndTask();
    consultElm.innerText = 'Consult'
  }
}

function transfer() {
  if (consultElm.innerText === 'End Consult') {
     sdk.consultTransferTask('agent');
     holdResumeElm.innerText = 'Hold';
     consultElm.innerText = 'Consult'
  } else {
    sdk.transferTask('1003', 'dialNumber');
  }

  holdResumeElm.disabled = true;
  consultElm.disabled = true;
  transferElm.disabled = true;
  recordingElm.disabled = true;
}

function pauseRecording() {
  if (recordingElm.innerText === 'Pause Recording') {
    sdk.pauseRecordingTask();
    recordingElm.innerText = 'Resume Recording';
  } else {
    sdk.resumeRecordingTask();
    recordingElm.innerText = 'Pause Recording';
  }
}

function wrapUp() {
  sdk.wrapUpTask();
}