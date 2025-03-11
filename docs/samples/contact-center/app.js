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
let isConsultOptionsShown = false;
let isTransferOptionsShown = false; // Add this variable to track the state of transfer options
let entryPointId = '';
let stateTimer;

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
const muteElm = document.querySelector('#mute-unmute');
const pauseResumeRecordingElm = document.querySelector('#pause-resume-recording');
const endElm = document.querySelector('#end');
const wrapupElm = document.querySelector('#wrapup');
const wrapupCodesDropdownElm = document.querySelector('#wrapupCodesDropdown');
const autoResumeCheckboxElm = document.querySelector('#auto-resume-checkbox');
const agentStateSelect = document.querySelector('#agentStateSelect');
const popup = document.querySelector('#agentStatePopup');
const setAgentStateButton = document.getElementById('setAgentState');
const consultOptionsElm = document.querySelector('#consult-options');
const destinationTypeDropdown = document.querySelector('#consult-destination-type');
const consultDestinationHolderElm = document.querySelector('#consult-destination-holder');
let consultDestinationInput = document.querySelector('#consult-destination');
let transferDestinationInput = document.querySelector('#transfer-destination');
const initiateTransferBtn = document.querySelector('#initiate-transfer');
const initiateConsultBtn = document.querySelector('#initiate-consult');
const endConsultBtn = document.querySelector('#end-consult');
const consultTabBtn = document.querySelector('#consult');
const initiateConsultControlsElm = document.querySelector('#initiate-consult-controls');
const initiateConsultDialog = document.querySelector('#initiate-consult-dialog');
const agentMultiLoginAlert = document.querySelector('#agentMultiLoginAlert');
const consultTransferBtn = document.querySelector('#consult-transfer');
const transferElm = document.getElementById('transfer');
const timerElm = document.querySelector('#timerDisplay');

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

setAgentStateButton.addEventListener('click', () => {
  agentStatus = agentStateSelect.options[agentStateSelect.selectedIndex].text;
  auxCodeId = agentStateSelect.options[agentStateSelect.selectedIndex].value;
  setAgentStatus();
  popup.classList.add('hidden');
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
  muteElm.disabled = true;
  endElm.disabled = true;
  pauseResumeRecordingElm.disabled = true;
  if(task) {
    wrapupElm.disabled = false;
    wrapupCodesDropdownElm.disabled = false;
  } else {
    wrapupElm.disabled = true;
    wrapupCodesDropdownElm.disabled = true;
  }
  hideEndConsultButton();
  showConsultButton()
  disableTransferControls();
  consultTabBtn.disabled = true;
  incomingDetailsElm.innerText = '';
  pauseResumeRecordingElm.innerText = 'Pause Recording';
}

function showInitiateConsultDialog() {
  initiateConsultDialog.showModal();
}

function closeConsultDialog() {
  initiateConsultDialog.close();
}

function showConsultButton() {
  consultTabBtn.style.display = 'inline-block';
}

function hideConsultButton() {
  consultTabBtn.style.display = 'none';
}

function showEndConsultButton() {
  endConsultBtn.style.display = 'inline-block';
}

function hideEndConsultButton() {
  endConsultBtn.style.display = 'none';
}

function toggleTransferOptions() {
  // toggle display of transfer options
  isTransferOptionsShown = !isTransferOptionsShown;
  const transferOptionsElm = document.querySelector('#transfer-options');
  transferOptionsElm.style.display = isTransferOptionsShown ? 'block' : 'none';
}

async function onConsultTypeSelectionChanged(){

  consultDestinationHolderElm.innerHTML = '';
  if(destinationTypeDropdown.value === 'agent'){
    // Make consultDestinationInput into a dropdown
    consultDestinationInput = document.createElement('select');
    consultDestinationInput.id = 'consultDestination';

    async function refreshBuddyAgentsForConsult() {
      consultDestinationInput.innerHTML = '';
      const agentNodeList = await fetchBuddyAgentsNodeList();
      agentNodeList.forEach( n => { consultDestinationInput.appendChild(n) });
    }

    await refreshBuddyAgentsForConsult();
    // Add a refresh button to refresh the buddy agents list
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-buddy-agents-for-consult';
    refreshButton.innerHTML = 'Refresh agent list <i class="fa fa-refresh"></i>';
    refreshButton.onclick = refreshBuddyAgentsForConsult;
    consultDestinationHolderElm.appendChild(refreshButton);
  } else {
    // Make consultDestinationInput into a text input
    consultDestinationInput = document.createElement('input');
    consultDestinationInput.id = 'consultDestination';
    consultDestinationInput.placeholder = 'Enter Destination';

    // Remove the refresh button if it exists
    const refreshButton = document.getElementById('refresh-buddy-agents-for-consult');
    if(refreshButton) {
      refreshButton.remove();
    }
  }

  consultDestinationHolderElm.appendChild(consultDestinationInput);
}

// Function to handle transfer type selection change
async function onTransferTypeSelectionChanged() {
  const transferDestinationHolderElm = document.querySelector('#transfer-destination-holder');
  transferDestinationHolderElm.innerHTML = '';

  if (document.querySelector('#transfer-destination-type').value === 'agent') {
    // Make transferDestinationInput into a dropdown
    transferDestinationInput = document.createElement('select');
    transferDestinationInput.id = 'transfer-destination';

    const agentNodeList = await fetchBuddyAgentsNodeList();
    agentNodeList.forEach(n => { transferDestinationInput.appendChild(n) });
  } else {
    // Make transferDestinationInput into a text input
    transferDestinationInput = document.createElement('input');
    transferDestinationInput.id = 'transfer-destination';
    transferDestinationInput.placeholder = 'Enter Destination';
  }

  transferDestinationHolderElm.appendChild(transferDestinationInput);
}

// Function to initiate consult
async function initiateConsult() {
  const destinationType = destinationTypeDropdown.value;
  const consultDestination = consultDestinationInput.value;

  if (!consultDestination) {
    alert('Please enter a destination');
    return;
  }

  closeConsultDialog();

  const consultPayload = {
    to: consultDestination,
    destinationType: destinationType,
  };

  try {
    await task.consult(consultPayload);
    console.log('Consult initiated successfully');
    hideConsultButton();
    showEndConsultButton();
    consultTransferBtn.style.display = 'inline-block'; // Show the consult transfer button
    consultTransferBtn.disabled = false; // Enable the consult transfer button
  } catch (error) {
    console.error('Failed to initiate consult', error);
    alert('Failed to initiate consult');
  }
}

// Function to initiate transfer
async function initiateTransfer() {
  const destinationType = document.querySelector('#transfer-destination-type').value;
  const transferDestination = transferDestinationInput.value;

  if (!transferDestination) {
    alert('Please enter a destination');
    return;
  }

  const transferPayload = {
    to: transferDestination,
    destinationType: destinationType,
  };

  try {
    await task.transfer(transferPayload);
    console.log('Transfer initiated successfully');
    disableTransferControls();
    toggleTransferOptions(); // Hide the transfer options
  } catch (error) {
    console.error('Failed to initiate transfer', error);
    alert('Failed to initiate transfer');
  }
}

// Function to initiate consult transfer
async function initiateConsultTransfer() {
  const destinationType = destinationTypeDropdown.value;
  const consultDestination = consultDestinationInput.value;

  if (!consultDestination) {
    alert('Please enter a destination');
    return;
  }

  const consultTransferPayload = {
    to: consultDestination,
    destinationType: destinationType,
  };

  try {
    await task.consultTransfer(consultTransferPayload);
    console.log('Consult transfer initiated successfully');
    consultTransferBtn.disabled = true; // Disable the consult transfer button after initiating consult transfer
    consultTransferBtn.style.display = 'none'; // Hide the consult transfer button after initiating consult transfer
  } catch (error) {
    console.error('Failed to initiate consult transfer', error);
  }
}

// Function to end consult
async function endConsult() {
  const taskId = task.data.interactionId;

  const consultEndPayload = {
    isConsult: true,
    taskId: taskId,
  };

  try {
    await task.endConsult(consultEndPayload);
    console.log('Consult ended successfully');
    hideEndConsultButton();
    showConsultButton();
  } catch (error) {
    console.error('Failed to end consult', error);
    alert('Failed to end consult');
  }
}

// Function to start an outdial call.
async function startOutdial() {

  const destination = document.getElementById('outBoundDialNumber').value;

  if (!destination || !destination.trim()) {
      alert('Destination number is required');
      return;
  }

  if (!entryPointId) {
      alert('Entry point ID is not configured');
      return;
  }

  try {
    console.log('Making an outdial call');
    await webex.cc.startOutdial(destination);
    console.log('Outdial call initiated successfully');
  } catch (error) {
    console.error('Failed to initiate outdial call', error);
    alert('Failed to initiate outdial call');
  }
}

// Function to press a key during an active call
function pressKey(value) {
    // Allow only digits, #, *, and +
    if (!/^[\d#*+]$/.test(value)) {
      console.warn('Invalid keypad input:', value);
      return;
    }
  document.getElementById('outBoundDialNumber').value += value;
}

// Enable consult button after task is accepted
function enableConsultControls() {
  consultTabBtn.disabled = false;
}

// Disable consult button after task is accepted
function disableConsultControls() {
  consultTabBtn.disabled = true;
}

// Enable transfer button after task is accepted
function enableTransferControls() {
  transferElm.disabled = false;
}

// Disable transfer button after task is accepted
function disableTransferControls() {
  transferElm.disabled = true;
}

// Register task listeners
function registerTaskListeners(task) {
  task.on('task:assigned', (task) => {
    console.info('Call has been accepted for task: ', task.data.interactionId);
    holdResumeElm.disabled = false;
    muteElm.disabled = false;
    holdResumeElm.innerText = 'Hold';
    pauseResumeRecordingElm.disabled = false;
    pauseResumeRecordingElm.innerText = 'Pause Recording';
    endElm.disabled = false;
    enableConsultControls(); // Enable consult controls
    enableTransferControls(); // Enable transfer controls
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

  task.on('task:hold', (task) => {
    console.info('Call has been put on hold');
    holdResumeElm.innerText = 'Resume';
  });

  // Consult flows
  task.on('task:consultOfferCreated', (task) => {
    console.log('Consult offer created');
  });

  task.on('task:consultAccepted', (task) => {
    // When we accept an incoming consult
    hideConsultButton();
    showEndConsultButton();
    consultTransferBtn.disabled = true; // Disable the consult transfer button since we are not yet owner of the call
  });

  task.on('task:consultQueueFailed', (task) => {
    // When trying to consult queue fails
    console.error(`Received task:consultQueueFailed for task: ${task.interactionId}`);
    hideEndConsultButton();
    showConsultButton();
  });

  task.on('task:consultQueueCancelled', (task) => {
    // When we manually cancel consult to queue before it is accepted by other agent
    console.log(`Received task:consultQueueCancelled for task: ${task.interactionId}`);
    hideEndConsultButton();
    showConsultButton();
  });

  task.on('task:consultEnd', (task) => {
    hideEndConsultButton();
    showConsultButton();
    consultTransferBtn.style.display = 'none';
    consultTransferBtn.disabled = true;

    answerElm.disabled = true;
    declineElm.disabled = true;
    if(task.data.isConsulted) {
      updateButtonsPostEndCall();
      incomingDetailsElm.innerText = '';
      task = undefined;
    }
  });
  task.on('task:rejected', (reason) => {
    console.info('Task is rejected with reason:', reason);
    if (reason === 'RONA_TIMER_EXPIRED') {
      answerElm.disabled = true;
      declineElm.disabled = true;
      incomingDetailsElm.innerText = 'No incoming calls';
    }
    showAgentStatePopup(reason);
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

function startStateTimer(lastStateChangeTimestamp, lastIdleCodeChangeTimestamp) {

  if (lastStateChangeTimestamp === null) {
    return;
  }
  
  if (stateTimer) {
    clearInterval(stateTimer);
  }

  stateTimer = setInterval(() => {
    const currentTime = new Date().getTime();
    const stateTimeDifference = currentTime - new Date(lastStateChangeTimestamp).getTime();
    const idleCodeChangeTimeDifference = lastIdleCodeChangeTimestamp ? currentTime - new Date(lastIdleCodeChangeTimestamp).getTime() : null;

    const stateHours = String(Math.floor(stateTimeDifference / (1000 * 60 * 60))).padStart(2, '0');
    const stateMinutes = String(Math.floor((stateTimeDifference % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
    const stateSeconds = String(Math.floor((stateTimeDifference % (1000 * 60)) / 1000)).padStart(2, '0');

    let timerDisplay = `${stateHours}:${stateMinutes}:${stateSeconds}`;

    if (idleCodeChangeTimeDifference !== null && lastStateChangeTimestamp !== lastIdleCodeChangeTimestamp) {
      console.log('Idle code change time difference: ', lastStateChangeTimestamp, " ",lastIdleCodeChangeTimestamp);
      const idleCodeChangeHours = String(Math.floor(idleCodeChangeTimeDifference / (1000 * 60 * 60))).padStart(2, '0');
      const idleCodeChangeMinutes = String(Math.floor((idleCodeChangeTimeDifference % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
      const idleCodeChangeSeconds = String(Math.floor((idleCodeChangeTimeDifference % (1000 * 60)) / 1000)).padStart(2, '0');

      timerDisplay = `${idleCodeChangeHours}:${idleCodeChangeMinutes}:${idleCodeChangeSeconds}`+ " / " + timerDisplay;
    }

    if (timerElm) {
      timerElm.innerHTML = timerDisplay;
    }
  }, 1000);
}


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
            if (agentProfile.lastStateAuxCodeId && agentProfile.lastStateAuxCodeId === idleCodes.id)
            {
              option.selected = true;
              startStateTimer(agentProfile.lastStateChangeTimestamp, agentProfile.lastIdleCodeChangeTimestamp);
            }
            idleCodesDropdown.add(option);
          }
        });
        entryPointId = agentProfile.outDialEp;
    }).catch((error) => {
        console.error('Event subscription failed', error);
    })

    webex.cc.on('task:incoming', (task) => {
      taskEvents.detail.task = task;

      incomingCallListener.dispatchEvent(taskEvents);
    });

    webex.cc.on('task:hydrate', (currentTask) => {
      handleTaskHydrate(currentTask);
    });

    webex.cc.on('agent:stateChange', (data) => {
      if (data && typeof data === 'object' && data.type === 'AgentStateChangeSuccess') {
        const DEFAULT_CODE = '0'; // Default code when no aux code is present
        idleCodesDropdown.value = data.auxCodeId?.trim() !== '' ? data.auxCodeId : DEFAULT_CODE;
        startStateTimer(data.lastStateChangeTimestamp, data.lastIdleCodeChangeTimestamp);
      }
    });

    webex.cc.on('agent:multiLogin', (data) => {
      if (data && typeof data === 'object' && data.type === 'AgentMultiLoginCloseSession') {
        agentMultiLoginAlert.innerHTML = 'Multiple Agent Login Session Detected!';  
        agentMultiLoginAlert.style.color = 'red';``
      }
    });
    
}

function handleTaskHydrate(currentTask) {
  task = currentTask;

  if (!task || !task.data || !task.data.interaction) {
    console.error('task:hydrate --> No task data found.');
    alert('task:hydrate --> No task data found.');
    
    return;
  }

  const { data, webCallingService } = task;
  const { interaction, mediaResourceId, agentId } = data;
  const {
    state,
    isTerminated,
    media,
    participants,
    callAssociatedDetails,
    callProcessingDetails
  } = interaction;

  if (isTerminated) {
    // wrapup
    if (state === 'wrapUp' && !participants[agentId].isWrappedUp) {
      wrapupCodesDropdownElm.disabled = false;
      wrapupElm.disabled = false;
    }

    return;
  }

  // answer & decline incoming calls
  const callerDisplay = callAssociatedDetails?.ani;
  if (webCallingService.loginOption === 'BROWSER') {
    answerElm.disabled = false;
    declineElm.disabled = false;

    incomingDetailsElm.innerText = `Call from ${callerDisplay}`;
  } else {
    incomingDetailsElm.innerText = `Call from ${callerDisplay}...please answer on the endpoint where the agent's extension is registered`;
  }

  // end button
  const hasParticipants = Object.keys(participants).length > 1;
  endElm.disabled = !hasParticipants;
  
  // hold/resume call
  const isHold = media && media[mediaResourceId] && media[mediaResourceId].isHold;
  holdResumeElm.disabled = isTerminated;
  holdResumeElm.innerText = isHold ? 'Resume' : 'Hold';

  if (callProcessingDetails) {
    const { pauseResumeEnabled, isPaused } = callProcessingDetails;

    // pause/resume recording
    pauseResumeRecordingElm.disabled = !pauseResumeEnabled;
    pauseResumeRecordingElm.innerText = isPaused === 'true' ? 'Resume Recording' : 'Pause Recording';
  }

  // end consult, consult transfer buttons
  const { consultMediaResourceId, destAgentId, destinationType } = data;
  if (consultMediaResourceId && destAgentId && destinationType) {
    const destination = participants[destAgentId];
    destinationTypeDropdown.value = destinationType;
    consultDestinationInput.value = destination.dn; 

    consultTabBtn.style.display = 'none';
    endConsultBtn.style.display = 'inline-block';
    consultTransferBtn.style.display = 'inline-block';
  }
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
  webex.cc.stationLogin({
    teamId: teamsDropdown.value,
    loginOption: agentDeviceType,
    dialNumber: dialNumber.value
  }).then((response) => {
    console.log('Agent Logged in successfully', response);
    loginAgentElm.disabled = true;
    logoutAgentElm.classList.remove('hidden');
    
    // Read auxCode and lastStateChangeTimestamp from login response
    const DEFAULT_CODE = '0'; // Default code when no aux code is present
    const auxCodeId = response.data.auxCodeId?.trim() !== '' ? response.data.auxCodeId : DEFAULT_CODE;
    const lastStateChangeTimestamp = response.data.lastStateChangeTimestamp;
    const lastIdleCodeChangeTimestamp = response.data.lastIdleCodeChangeTimestamp;
    const index = [...idleCodesDropdown.options].findIndex(option => option.value === auxCodeId);
    idleCodesDropdown.selectedIndex = index !== -1 ? index : 0;
    startStateTimer(lastStateChangeTimestamp, lastIdleCodeChangeTimestamp);
    
  }).catch((error) => {
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

function showAgentStatePopup(reason) {
  const agentStateReasonText = document.getElementById('agentStateReasonText');
  agentStateSelect.innerHTML = '';

  // Set the reason text based on the reason
  if (reason === 'USER_BUSY') {
    agentStateReasonText.innerText = 'Agent declined call';
  } else if (reason === 'RONA_TIMER_EXPIRED') {
    agentStateReasonText.innerText = 'Agent unavailable';
  } else {
    agentStateReasonText.innerText = '';
  }

  for (let i = 0; i < idleCodesDropdown.options.length; i++) {
    const option = document.createElement('option');
    option.value = idleCodesDropdown.options[i].value;
    option.text = idleCodesDropdown.options[i].text;
    agentStateSelect.add(option);
  }

  popup.classList.remove('hidden');
}

async function renderBuddyAgents() {
  buddyAgentsDropdownElm.innerHTML = ''; // Clear previous options
  const buddyAgentsDropdownNodes = await fetchBuddyAgentsNodeList();
  buddyAgentsDropdownNodes.forEach( n => { buddyAgentsDropdownElm.appendChild(n) });
}

async function fetchBuddyAgentsNodeList() {
  const nodeList = [];
  try {
    const buddyAgentsResponse = await webex.cc.getBuddyAgents({mediaType: 'telephony'});

    if (!buddyAgentsResponse || !buddyAgentsResponse.data) {
      console.error('Failed to fetch buddy agents');
      const buddyAgentsDropdownNode = document.createElement('option');
      buddyAgentsDropdownNode.disabled = true;
      buddyAgentsDropdownNode.innerText = 'Failed to fetch buddy agents';
      return [buddyAgentsDropdownNode];
    }

    if (buddyAgentsResponse.data.agentList.length === 0) {
      console.log('The fetched buddy agents list was empty');
      const buddyAgentsDropdownNode = document.createElement('option');
      buddyAgentsDropdownNode.disabled = true;
      buddyAgentsDropdownNode.innerText = 'No buddy agents available';
      return [buddyAgentsDropdownNode];
    }

    buddyAgentsResponse.data.agentList.forEach((agent) => {
      const option = document.createElement('option');
      option.text = `${agent.agentName} - ${agent.state}`;
      option.value = agent.agentId;
      nodeList.push(option);
    });
    return nodeList;

  } catch (error) {
    console.error('Failed to fetch buddy agents', error);
    const buddyAgentsDropdownNode = document.createElement('option');
    buddyAgentsDropdownNode.disabled = true;
    buddyAgentsDropdownNode.innerText = `Failed to fetch buddy agents, ${error}`;
    return [buddyAgentsDropdownNode];
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

function muteUnmute() {
  if (muteElm.innerText === 'Mute') {
    muteElm.innerText = 'Unmute';
    console.info('Call is muted');
  } else {
    muteElm.innerText = 'Mute';
    console.info('Call is unmuted');
  }
  task.toggleMute();
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