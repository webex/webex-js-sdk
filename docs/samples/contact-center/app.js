// Globals
let webex;
let sdk;
let agentDeviceType;
let deviceId;
let agentStatusId;
let agentStatus;
let agentId;
let taskControl;
let task;
let taskId;
let wrapupCodes = []; // Add this to store wrapup codes

const authTypeElm = document.querySelector('#auth-type');
const credentialsFormElm = document.querySelector('#credentials');
const tokenElm = document.querySelector('#access-token');
const saveElm = document.querySelector('#access-token-save');
const authStatusElm = document.querySelector('#access-token-status');
const oauthFormElm = document.querySelector('#oauth');
const oauthStatusElm = document.querySelector('#oauth-status');
const registerBtn = document.querySelector('#webexcc-register');
const teamsDropdown = document.querySelector('#teamsDropdown');
const agentLogin = document.querySelector('#AgentLogin');
const loginAgentElm = document.querySelector('#loginAgent');
const dialNumber = document.querySelector('#dialNumber');
const registerStatus = document.querySelector('#ws-connection-status');
const idleCodesDropdown = document.querySelector('#idleCodesDropdown')
const setAgentStatusButton = document.querySelector('#setAgentStatus');
const logoutAgentElm = document.querySelector('#logoutAgent');
const buddyAgentsDropdownElm = document.getElementById('buddyAgentsDropdown');
const incomingCallListener = document.querySelector('#incomingsection');
const incomingDetailsElm = document.querySelector('#incoming-call');
const answerElm = document.querySelector('#answer');
const declineElm = document.querySelector('#decline');
const callControlListener = document.querySelector('#callcontrolsection');
const holdResumeElm = document.querySelector('#hold-resume');
const pauseResumeRecordingElm = document.querySelector('#pause-resume-recording');
const endElm = document.querySelector('#end');
const wrapupElm = document.querySelector('#wrapup');
const wrapupCodesDropdownElm = document.querySelector('#wrapupCodesDropdown');
const autoResumeCheckboxElm = document.querySelector('#auto-resume-checkbox'); // Add this

// Store and Grab `access-token` from sessionStorage
if (sessionStorage.getItem('date') > new Date().getTime()) {
  tokenElm.value = sessionStorage.getItem('access-token');
}
else {
  sessionStorage.removeItem('access-token');
}

tokenElm.addEventListener('change', (event) => {
  sessionStorage.setItem('access-token', event.target.value);
  sessionStorage.setItem('date', new Date().getTime() + (12 * 60 * 60 * 1000));
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

function initOauth() {
  let redirectUri = `${window.location.protocol}//${window.location.host}`;

  if (window.location.pathname) {
    redirectUri += window.location.pathname;
  }

  // Reference: https://developer.webex-cx.com/documentation/integrations
  const ccMandatoryScopes = [
    "cjp:config_read",
    "cjp:config_write",
    "cjp:config",
    "cjp:user",
  ];

  const webRTCCallingScopes = [
    "spark:webrtc_calling",
    "spark:calls_read",
    "spark:calls_write",
    "spark:xsi"
  ];

  const additionalScopes = [
    "spark:kms", // to avoid token downscope to only spark:kms error on SDK init
  ];

  const requestedScopes = Array.from(
    new Set(
        ccMandatoryScopes
        .concat(webRTCCallingScopes)
        .concat(additionalScopes))
      ).join(' ');

  webex = window.webex = Webex.init({
    config: generateWebexConfig({
      credentials: {
        client_id: 'C70599433db154842e919ad9e18273d835945ff198251c82204b236b157b3a213',
        redirect_uri: redirectUri,
        scope: requestedScopes,
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

const taskEvents = new CustomEvent('task:incoming', {
  detail: {
    task: task,
  },
});

function updateButtonsPostEndCall() {
  holdResumeElm.disabled = true;
  endElm.disabled = true;
  pauseResumeRecordingElm.disabled = true;
  wrapupElm.disabled = false;
  wrapupCodesDropdownElm.disabled = false;
}

function registerTaskListeners(task) {
  task.on('task:assigned', (task) => {
    console.info('Call has been accepted for task: ', task.data.interactionId);
    holdResumeElm.disabled = false;
    holdResumeElm.innerText = 'Hold';
    pauseResumeRecordingElm.disabled = false;
    pauseResumeRecordingElm.innerText = 'Pause Recording';
    endElm.disabled = false;
  });
  task.on('task:media', (track) => {
    document.getElementById('remote-audio').srcObject = new MediaStream([track]);
  });
  task.on('task:end', (wrapupData) => {
    if (!wrapupData.wrapupRequired) {
      answerElm.disabled = true;
      declineElm.disabled = true;
      console.log('Call ended without call being answered');
    }
    incomingDetailsElm.innerText = '';
    if (!endElm.disabled) {
      console.info('Call ended successfully by the external user');
      updateButtonsPostEndCall();
    }
  });
}

function generateWebexConfig({credentials}) {
  return {
    appName: 'sdk-samples',
    appPlatform: 'testClient',
    fedramp: false,
    logger: {
      level: 'log'
    },
    credentials,
    // Any other sdk config we need
  };
}

if(localStorage.getItem('OAuth')) {
  setTimeout(() => {
    initOauth();
    localStorage.removeItem('OAuth');
  }, 500);
}

function initWebex(e) {
  e.preventDefault();
  console.log('Authentication#initWebex()');

  tokenElm.disabled = true;
  saveElm.disabled = true;
  authStatusElm.innerText = 'initializing...';

  const webexConfig = generateWebexConfig({})

  webex = window.webex = Webex.init({
    config: webexConfig,
    credentials: {
      access_token: tokenElm.value
    }
  });

  webex.once('ready', async () => {
    console.log('Authentication#initWebex() :: Webex Ready');

    authStatusElm.innerText = 'Saved access token!';
    registerStatus.innerHTML = 'Not Subscribed';
    registerBtn.disabled = false;
  });

  return false;
}

credentialsFormElm.addEventListener('submit', initWebex);


function register() {
    webex.cc.register(true).then((agentProfile) => {
        registerStatus.innerHTML = 'Subscribed';
        console.log('Event subscription successful: ', agentProfile);
        teamsDropdown.innerHTML = ''; // Clear previously selected option on teamsDropdown
        const listTeams = agentProfile.teams;
        agentId = agentProfile.agentId;
        wrapupCodes = agentProfile.wrapupCodes;
        populateWrapupCodesDropdown();
        listTeams.forEach((team) => {
            const option = document.createElement('option');
            option.value = team.id;
            option.text = team.name;
            teamsDropdown.add(option);
        });
        const loginVoiceOptions = agentProfile.loginVoiceOptions;
        agentLogin.innerHTML = '<option value="" selected>Choose Agent Login ...</option>'; // Clear previously selected option on agentLogin.
        dialNumber.value = agentProfile.defaultDn ? agentProfile.defaultDn : '';
        dialNumber.disabled = agentProfile.defaultDn ? false : true;
        if (loginVoiceOptions.length > 0) loginAgentElm.disabled = false;
        loginVoiceOptions.forEach((voiceOptions)=> {
          const option = document.createElement('option');
          option.text = voiceOptions;
          option.value = voiceOptions;
          agentLogin.add(option);
          option.selected = agentProfile.isAgentLoggedIn && voiceOptions === agentProfile.deviceType;
        });

        if (agentProfile.isAgentLoggedIn) {
          loginAgentElm.disabled = true;
          logoutAgentElm.classList.remove('hidden');
        }

        const idleCodesList = agentProfile.idleCodes;
        if(idleCodesList.length > 0) {
           setAgentStatusButton.disabled = false;
        }
        idleCodesList.forEach((idleCodes) => {
          if(idleCodes.isSystem === false) {
            const option  = document.createElement('option');
            option.text = idleCodes.name;
            option.value = idleCodes.id;
            idleCodesDropdown.add(option);
          }
        });
    }).catch((error) => {
        console.error('Event subscription failed', error);
    })

    webex.cc.on('task:incoming', (task) => {
      taskEvents.detail.task = task;

      incomingCallListener.dispatchEvent(taskEvents);
    });

    webex.cc.on('agent:stateChange', (data) => {
      if (data && typeof data === 'object' && data.type === 'AgentStateChangeSuccess') {
        const DEFAULT_CODE = '0'; // Default code when no aux code is present
        idleCodesDropdown.value = data.auxCodeId?.trim() !== '' ? data.auxCodeId : DEFAULT_CODE;
      }
    });
}

function populateWrapupCodesDropdown() {
  wrapupCodesDropdownElm.innerHTML = ''; // Clear previous options
  wrapupCodes.forEach((code) => {
    const option = document.createElement('option');
    option.text = code.name;
    option.value = code.id;
    wrapupCodesDropdownElm.add(option);
  });
}

async function handleAgentLogin(e) {
  const value = e.target.value;
  agentDeviceType = value
  if (value === 'AGENT_DN') {
    dialNumber.disabled = false;
  } else if (value === 'EXTENSION') {
    dialNumber.disabled = false;
  } else {
    dialNumber.disabled = true;
  }
}

function doAgentLogin() {
  webex.cc.stationLogin({teamId: teamsDropdown.value, loginOption: agentDeviceType, dialNumber: dialNumber.value}).then((response) => {
    console.log('Agent Logged in successfully', response);
    loginAgentElm.disabled = true;
    logoutAgentElm.classList.remove('hidden');
  }
  ).catch((error) => {
    console.log('Agent Login failed', error);
  });
}

async function handleAgentStatus(event) {
  auxCodeId = event.target.value;
  agentStatus = idleCodesDropdown.options[idleCodesDropdown.selectedIndex].text;
}

function setAgentStatus() {
  let state = "Available";
  if(agentStatus !== 'Available') state = 'Idle';
  webex.cc.setAgentState({state, auxCodeId, lastStateChangeReason: agentStatus, agentId}).then((response) => {
    console.log('Agent status set successfully', response);
  }).catch(error => {
    console.error('Agent status set failed', error);
  });
}


function logoutAgent() {
  webex.cc.stationLogout({logoutReason: 'logout'}).then((response) => {
    console.log('Agent logged out successfully', response);
    loginAgentElm.disabled = false;

    setTimeout(() => {
      logoutAgentElm.classList.add('hidden');
      agentLogin.selectedIndex = 0;
    }, 1000);
  }
  ).catch((error) => {
    console.log('Agent logout failed', error);
  });
}

async function fetchBuddyAgents() {
  try {
    buddyAgentsDropdownElm.innerHTML = ''; // Clear previous options
    const buddyAgentsResponse = await webex.cc.getBuddyAgents({mediaType: 'telephony'});

    if (!buddyAgentsResponse || !buddyAgentsResponse.data) {
      console.error('Failed to fetch buddy agents');
      buddyAgentsDropdownElm.innerHTML = `<option disabled="true">Failed to fetch buddy agents<option>`;
      return;
    }

    if (buddyAgentsResponse.data.agentList.length === 0) {
      console.log('The fetched buddy agents list was empty');
      buddyAgentsDropdownElm.innerHTML = `<option disabled="true">No buddy agents available<option>`;
      return;
    }

    buddyAgentsResponse.data.agentList.forEach((agent) => {
      const option = document.createElement('option');
      option.text = `${agent.agentName} - ${agent.state}`;
      option.value = agent.agentId;
      buddyAgentsDropdownElm.add(option);
    });

  } catch (error) {
    console.error('Failed to fetch buddy agents', error);
    buddyAgentsDropdownElm.innerHTML = ''; // Clear previous options
    buddyAgentsDropdownElm.innerHTML = `<option disabled="true">Failed to fetch buddy agents, ${error}<option>`;
  }
}

incomingCallListener.addEventListener('task:incoming', (event) => {
  task = event.detail.task;
  taskId = event.detail.task.data.interactionId;

  const callerDisplay = event.detail.task.data.interaction.callAssociatedDetails.ani;
  registerTaskListeners(task);

  if (task.webCallingService.loginOption === 'BROWSER') {
    answerElm.disabled = false;
    declineElm.disabled = false;

    incomingDetailsElm.innerText = `Call from ${callerDisplay}`;
  } else {
    incomingDetailsElm.innerText = `Call from ${callerDisplay}...please answer on the endpoint where the agent's extension is registered`;
  }
});

function answer() {
  answerElm.disabled = true;
  declineElm.disabled = true;
  task.accept(taskId);
  incomingDetailsElm.innerText = 'Call Accepted';
}

function decline() {
  answerElm.disabled = true;
  declineElm.disabled = true;
  task.decline(taskId);
  incomingDetailsElm.innerText = 'No incoming calls';
}

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
    sessionStorage.setItem('access-token', accessToken);
    sessionStorage.setItem('date', new Date().getTime() + parseInt(expiresIn, 10));
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

function holdResumeCall() {
  if (holdResumeElm.innerText === 'Hold') {
    holdResumeElm.disabled = true;
    task.hold().then(() => {
      console.info('Call held successfully');
      holdResumeElm.innerText = 'Resume';
      holdResumeElm.disabled = false;
    }).catch((error) => {
      console.error('Failed to hold the call', error);
      holdResumeElm.disabled = false;
    });
  } else {
    holdResumeElm.disabled = true;
    task.resume().then(() => {
      console.info('Call resumed successfully');
      holdResumeElm.innerText = 'Hold';
      holdResumeElm.disabled = false;
    }).catch((error) => {
      console.error('Failed to resume the call', error);
      holdResumeElm.disabled = false;
    });
  }
}

function togglePauseResumeRecording() {
  const autoResumed = autoResumeCheckboxElm.checked;
  if (pauseResumeRecordingElm.innerText === 'Pause Recording') {
    pauseResumeRecordingElm.disabled = true;
    task.pauseRecording().then(() => {
      console.info('Recording paused successfully');
      pauseResumeRecordingElm.innerText = 'Resume Recording';
      pauseResumeRecordingElm.disabled = false;
      autoResumeCheckboxElm.disabled = false;
    }).catch((error) => {
      console.error('Failed to pause recording', error);
      pauseResumeRecordingElm.disabled = false;
    });
  } else {
    pauseResumeRecordingElm.disabled = true;
    task.resumeRecording({ autoResumed: autoResumed }).then(() => {
      console.info('Recording resumed successfully');
      pauseResumeRecordingElm.innerText = 'Pause Recording';
      pauseResumeRecordingElm.disabled = false;
      autoResumeCheckboxElm.disabled = true;
    }).catch((error) => {
      console.error('Failed to resume recording', error);
      pauseResumeRecordingElm.disabled = false;
    });
  }
}

function endCall() {
  endElm.disabled = true;
  task.end().then(() => {
    console.log('Call ended successfully by agent');
    updateButtonsPostEndCall();
  }).catch((error) => {
    console.error('Failed to end the call', error);
    endElm.disabled = false;
  });
}

function wrapupCall() {
  wrapupElm.disabled = true;
  const wrapupReason = wrapupCodesDropdownElm.options[wrapupCodesDropdownElm.selectedIndex].text;
  const auxCodeId = wrapupCodesDropdownElm.options[wrapupCodesDropdownElm.selectedIndex].value;
  task.wrapup({wrapUpReason: wrapupReason, auxCodeId: auxCodeId}).then(() => {
    console.info('Call wrapped up successfully');
    holdResumeElm.disabled = true;
    endElm.disabled = true;
    wrapupCodesDropdownElm.disabled = true;
  }).catch((error) => {
    console.error('Failed to wrap up the call', error);
    wrapupElm.disabled = false;
  });
}
