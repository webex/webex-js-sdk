// Globals
let webex = undefined;
let sdk;
let agentDeviceType;
let deviceId;
let agentStatusId;
let agentStatus;
let agentId;
let agentName
let taskControl;
let currentTask;
let taskId;
let wrapupCodes = []; // Add this to store wrapup codes
let consultationData = null; // Track who we consulted with for conference
let entryPointId = '';
let stateTimer;
let currentConsultQueueId;
let campaignCountdownInterval = null; // Campaign preview countdown timer
let campaignPreviewAutoAction = null; // Auto-action on timeout: ACCEPT, SKIP, REMOVE
let outdialANIId; // Store outdial ANI ID from agent profile
const taskCreationTimes = new Map(); // Track when tasks first appear (taskId -> timestamp)

const authTypeElm = document.querySelector('#auth-type');
const credentialsFormElm = document.querySelector('#credentials');
const tokenElm = document.querySelector('#access-token');
const saveElm = document.querySelector('#access-token-save');
const authStatusElm = document.querySelector('#access-token-status');
const oauthFormElm = document.querySelector('#oauth');
const oauthStatusElm = document.querySelector('#oauth-status');
const registerBtn = document.querySelector('#webexcc-register');
const deregisterBtn = document.querySelector('#webexcc-deregister');
const teamsDropdown = document.querySelector('#teamsDropdown');
const agentLogin = document.querySelector('#AgentLogin');
const loginAgentElm = document.querySelector('#loginAgent');
const dialNumber = document.querySelector('#dialNumber');
const registerStatus = document.querySelector('#ws-connection-status');
const idleCodesDropdown = document.querySelector('#idleCodesDropdown')
const setAgentStatusButton = document.querySelector('#setAgentStatus');
const logoutAgentElm = document.querySelector('#logoutAgent');
const buddyAgentsDropdownElm = document.getElementById('buddyAgentsDropdown');
const updateAgentProfileElm = document.querySelector('#updateAgentProfile');
const updateFieldsContainer = document.querySelector('#updateAgentProfileFields');
const updateLoginOptionElm = document.querySelector('#updateLoginOption');
const updateDialNumberElm  = document.querySelector('#updateDialNumber');
const updateTeamDropdownElm = document.querySelector('#updateTeamDropdown');
const incomingCallListener = document.querySelector('#incomingsection');
const incomingDetailsElm = document.querySelector('#incoming-task');
const participantListElm = document.querySelector('#participant-list');

const answerElm = document.querySelector('#answer');
const declineElm = document.querySelector('#decline');
const callControlListener = document.querySelector('#callcontrolsection');
const taskControlsCardsElm = document.querySelector('#taskControlsCards');
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
const transferOptionsElm = document.querySelector('#transfer-options');
const mergeConferenceBtn = document.querySelector('#merge-conference');
const exitConferenceBtn = document.querySelector('#exit-conference');
const transferConferenceBtn = document.querySelector('#transfer-conference');
const switchToMainBtn = document.querySelector('#switch-to-main');
const switchToConsultBtn = document.querySelector('#switch-to-consult');
const conferenceToggleBtn = document.querySelector('#conference-toggle');
const timerElm = document.querySelector('#timerDisplay');
const engageElm = document.querySelector('#engageWidget');
let isBundleLoaded = false; // this is just to check before loading/using engage widgets
const uploadLogsButton = document.getElementById('upload-logs');
const uploadLogsResultElm = document.getElementById('upload-logs-result');
const agentLoginGenericError = document.getElementById('agent-login-generic-error');
const agentLoginInputError = document.getElementById('agent-login-input-error');
const applyupdateAgentProfileBtn = document.querySelector('#applyupdateAgentProfile');
const changeEnvBtn = document.querySelector('#changeEnv');
const autoWrapupTimerElm = document.getElementById('autoWrapupTimer');
const timerValueElm = autoWrapupTimerElm.querySelector('.timer-value');
const outdialAniSelectElm = document.querySelector('#outdialAniSelect');
const realtimeTranscriptsElm = document.querySelector('#realtime-transcripts-content');
const clearTranscriptsButton = document.querySelector('#clear-transcripts');
const liveTranscriptTabElm = document.querySelector('#transcript-tab-live');
const ivrTranscriptTabElm = document.querySelector('#transcript-tab-ivr');
const liveTranscriptPaneElm = document.querySelector('#transcript-live-pane');
const ivrTranscriptPaneElm = document.querySelector('#transcript-ivr-pane');
const aiAssistantContentElm = document.querySelector('#ai-assistant-content');
const aiAssistantContextInputElm = document.querySelector('#assistant-context-input');
const aiAssistantActionBtn = document.querySelector('#get-assistance');
const aiAssistantContextBtn = document.querySelector('#send-assistant-context');
const aiAssistantRawToggleBtn = document.querySelector('#assistant-raw-output-toggle');
const aiAssistantRawOutputPanelElm = document.querySelector('#assistant-raw-output-panel');
const aiAssistantRawOutputContentElm = document.querySelector('#assistant-raw-output-content');
const multiLoginCheckbox = document.querySelector('#multiLoginFlag');
const disableWebRTCRegistrationCheckbox = document.querySelector('#disableWebRTCRegistrationFlag');
deregisterBtn.style.backgroundColor = 'red';
let enableProd = true;

function changeEnv() {
  enableProd = !enableProd;
  changeEnvBtn.innerHTML = enableProd ? 'In Production' : 'In Integration';
}

let isMultiLoginEnabled = localStorage.getItem('isMultiLoginEnabled') === 'true';
if (multiLoginCheckbox) {
  multiLoginCheckbox.checked = isMultiLoginEnabled;
}

let isWebRTCRegistrationDisabled =
  localStorage.getItem('isWebRTCRegistrationDisabled') === 'true';
if (disableWebRTCRegistrationCheckbox) {
  disableWebRTCRegistrationCheckbox.checked = isWebRTCRegistrationDisabled;
}

function toggleMultiLogin() {
  isMultiLoginEnabled = multiLoginCheckbox.checked;
  localStorage.setItem('isMultiLoginEnabled', String(isMultiLoginEnabled));
}

function toggleWebRTCRegistration() {
  isWebRTCRegistrationDisabled = disableWebRTCRegistrationCheckbox.checked;
  localStorage.setItem('isWebRTCRegistrationDisabled', String(isWebRTCRegistrationDisabled));
}

const transcriptEntries = [];
const MAX_TRANSCRIPT_LINES = 200;
const registeredTaskListeners = new WeakSet();

function formatTranscriptTime(epochMillis) {
  if (!epochMillis || typeof epochMillis !== 'number') {
    return '--:--';
  }
  return new Date(epochMillis).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

function setTranscriptTab(tab) {
  if (!liveTranscriptTabElm || !ivrTranscriptTabElm || !liveTranscriptPaneElm || !ivrTranscriptPaneElm) {
    return;
  }

  const isLive = tab === 'live';
  liveTranscriptTabElm.classList.toggle('active', isLive);
  ivrTranscriptTabElm.classList.toggle('active', !isLive);
  liveTranscriptTabElm.setAttribute('aria-selected', isLive ? 'true' : 'false');
  ivrTranscriptTabElm.setAttribute('aria-selected', !isLive ? 'true' : 'false');
  liveTranscriptPaneElm.classList.toggle('hidden', !isLive);
  ivrTranscriptPaneElm.classList.toggle('hidden', isLive);
}

function renderRealtimeTranscripts() {
  if (!realtimeTranscriptsElm) {
    return;
  }

  realtimeTranscriptsElm.innerHTML = '';
  if (!transcriptEntries.length) {
    const emptyElm = document.createElement('div');
    emptyElm.className = 'transcript-empty';
    emptyElm.textContent = 'No live transcript received.';
    realtimeTranscriptsElm.appendChild(emptyElm);
    return;
  }

  const fragment = document.createDocumentFragment();
  transcriptEntries.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'transcript-item';

    const avatar = document.createElement('div');
    avatar.className = 'transcript-avatar';
    avatar.textContent = entry.role === 'AGENT' ? 'AG' : 'CU';

    const body = document.createElement('div');

    const meta = document.createElement('div');
    meta.className = 'transcript-meta';
    meta.textContent = entry.role === 'AGENT' ? '%You%' : '%Customer%';

    const time = document.createElement('span');
    time.className = 'transcript-time';
    time.textContent = formatTranscriptTime(entry.publishTimestamp);
    meta.appendChild(time);

    const content = document.createElement('div');
    content.className = 'transcript-content';
    content.textContent = entry.content;

    body.appendChild(meta);
    body.appendChild(content);
    row.appendChild(avatar);
    row.appendChild(body);
    fragment.appendChild(row);
  });

  realtimeTranscriptsElm.appendChild(fragment);
  realtimeTranscriptsElm.parentElement.scrollTop = realtimeTranscriptsElm.parentElement.scrollHeight;
}

function appendRealtimeTranscript(payload) {
  const dataNode = payload?.data;
  const transcriptNode = dataNode?.data || dataNode;
  const transcriptContent = transcriptNode?.content;
  if (!transcriptContent || typeof transcriptContent !== 'string') {
    return;
  }

  transcriptEntries.push({
    role: transcriptNode?.role || 'CALLER',
    publishTimestamp: transcriptNode?.publishTimestamp || Date.now(),
    content: transcriptContent.trim(),
  });
  if (transcriptEntries.length > MAX_TRANSCRIPT_LINES) {
    transcriptEntries.shift();
  }

  renderRealtimeTranscripts();
  setTranscriptTab('live');
}

let aiAssistantListening = false;
let isAssistantRawOutputVisible = false;

function resetAssistantRawOutput() {
  isAssistantRawOutputVisible = false;
  if (aiAssistantRawToggleBtn) {
    aiAssistantRawToggleBtn.disabled = true;
    aiAssistantRawToggleBtn.textContent = 'Show raw output';
  }
  if (aiAssistantRawOutputPanelElm) {
    aiAssistantRawOutputPanelElm.style.display = 'none';
  }
  if (aiAssistantRawOutputContentElm) {
    aiAssistantRawOutputContentElm.textContent = '';
  }
}

function setAssistantRawOutput(payload) {
  if (aiAssistantRawOutputContentElm) {
    aiAssistantRawOutputContentElm.textContent = JSON.stringify(payload, null, 2);
  }
  if (aiAssistantRawToggleBtn) {
    aiAssistantRawToggleBtn.disabled = false;
  }
}

function toggleAssistantRawOutput() {
  isAssistantRawOutputVisible = !isAssistantRawOutputVisible;
  if (aiAssistantRawOutputPanelElm) {
    aiAssistantRawOutputPanelElm.style.display = isAssistantRawOutputVisible ? 'block' : 'none';
  }
  if (aiAssistantRawToggleBtn) {
    aiAssistantRawToggleBtn.textContent = isAssistantRawOutputVisible
      ? 'Hide raw output'
      : 'Show raw output';
  }
}

function showListeningIndicator() {
  if (!aiAssistantContentElm) return;
  removeListeningIndicator();
  const listeningElm = document.createElement('div');
  listeningElm.className = 'assistant-listening';
  listeningElm.id = 'assistant-listening-indicator';
  listeningElm.innerHTML = `
    <span class="assistant-listening__dots"><span></span><span></span></span>
    <span>Listening for information</span>
  `;
  aiAssistantContentElm.appendChild(listeningElm);
  aiAssistantContentElm.scrollTop = aiAssistantContentElm.scrollHeight;
}

function removeListeningIndicator() {
  const existing = document.getElementById('assistant-listening-indicator');
  if (existing) existing.remove();
}

function appendSuggestionCard(data, options = {}) {
  if (!aiAssistantContentElm) return;

  const keepListening = options.keepListening === true;
  removeListeningIndicator();

  const card = document.createElement('div');
  card.className = 'assistant-suggestion-card';
  card.innerHTML = `
    <div class="assistant-suggestion-card__title"></div>
    <div class="assistant-suggestion-card__body"></div>
    <div class="assistant-suggestion-card__meta"></div>
  `;
  card.querySelector('.assistant-suggestion-card__title').textContent = data.title || 'Suggested response';
  card.querySelector('.assistant-suggestion-card__body').textContent = data.suggestion || '';
  card.querySelector('.assistant-suggestion-card__meta').textContent = data.suggestionSource || '';
  aiAssistantContentElm.appendChild(card);

  if (keepListening) {
    aiAssistantListening = true;
    showListeningIndicator();
  } else {
    aiAssistantListening = false;
  }

  aiAssistantContentElm.scrollTop = aiAssistantContentElm.scrollHeight;
}

async function requestSuggestedResponse() {
  if (!currentTask || !webex?.cc?.apiAIAssistant) return;

  const interactionId = currentTask.data.interactionId;
  const context = aiAssistantContextInputElm?.value?.trim();

  // Show context as a request bubble if provided
  if (context && aiAssistantContentElm) {
    const requestElm = document.createElement('div');
    requestElm.className = 'assistant-request';
    requestElm.textContent = context;
    aiAssistantContentElm.appendChild(requestElm);
    aiAssistantContentElm.scrollTop = aiAssistantContentElm.scrollHeight;
  }

  aiAssistantListening = true;
  resetAssistantRawOutput();
  if (aiAssistantActionBtn) aiAssistantActionBtn.style.display = 'none';
  const contextRow = document.getElementById('assistant-context-row');
  if (contextRow) contextRow.style.display = 'flex';
  showListeningIndicator();

  try {
    await webex.cc.apiAIAssistant.getSuggestedResponse({
      agentId,
      interactionId,
      actionTimeStamp: Date.now(),
      ...(context ? {context} : {}),
    });
    if (aiAssistantContextInputElm) aiAssistantContextInputElm.value = '';
  } catch (error) {
    aiAssistantListening = false;
    removeListeningIndicator();
    console.error('Suggestion request failed:', error);
    if (aiAssistantContentElm) {
      const errorElm = document.createElement('div');
      errorElm.className = 'assistant-error';
      errorElm.textContent = error?.message || 'Unable to get AI assistance.';
      aiAssistantContentElm.appendChild(errorElm);
    }
  }
}

if (liveTranscriptTabElm) {
  liveTranscriptTabElm.addEventListener('click', () => setTranscriptTab('live'));
}
if (ivrTranscriptTabElm) {
  ivrTranscriptTabElm.addEventListener('click', () => setTranscriptTab('ivr'));
}

if (clearTranscriptsButton) {
  clearTranscriptsButton.addEventListener('click', () => {
    transcriptEntries.length = 0;
    renderRealtimeTranscripts();
  });
}

if (aiAssistantActionBtn) {
  aiAssistantActionBtn.addEventListener('click', requestSuggestedResponse);
}

if (aiAssistantContextBtn) {
  aiAssistantContextBtn.addEventListener('click', requestSuggestedResponse);
}

if (aiAssistantContextInputElm) {
  aiAssistantContextInputElm.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      requestSuggestedResponse();
    }
  });
}

if (aiAssistantRawToggleBtn) {
  aiAssistantRawToggleBtn.addEventListener('click', toggleAssistantRawOutput);
}

function isIncomingTask(task, agentId) {
  const taskData = task?.data;
  const taskState = taskData?.interaction?.state;
  const participants = taskData?.interaction?.participants;
  const hasJoined = agentId && participants?.[agentId]?.hasJoined;

  return (
    !taskData?.wrapUpRequired &&
    !hasJoined &&
    (taskState === 'new' || taskState === 'consult' || taskState === 'connected' || taskState === 'conference')
  );
};

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

async function uploadLogs() {
  try {
    uploadLogsButton.disabled = true;
    const uploadResponse = await webex.cc.uploadLogs();
    console.log('Logs uploaded successfully');
    uploadLogsResultElm.innerText = `Logs uploaded successfully with feedbackId: ${uploadResponse.feedbackId}`;
    uploadLogsButton.disabled = false;
  } catch (error) {
    console.error('Failed to upload logs:', error);
    uploadLogsResultElm.innerText = 'Failed to upload logs';
    uploadLogsButton.disabled = false;
  }
}

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

  const webexConfig = generateWebexConfig({
    credentials: {
      ...(!enableProd && {authorizeUrl: 'https://idbrokerbts.webex.com/idb/oauth2/v1/authorize'}),
      client_id: enableProd ? 'C04ef08ffce356c3161bb66b15dbdd98d26b6c683c5ce1a1a89efad545fdadd74' : 'Cd0dd53db1f470a5a9941e5eee31575bd0889d7006e3a80a1443ad12a42049da1',
      redirect_uri: redirectUri,
      scope: requestedScopes,
    }
  });

  if (!enableProd) {
    webexConfig.services = {
      discovery: {
        u2c: 'https://u2c-intb.ciscospark.com/u2c/api/v1',
      },
    };
  }

  webex = window.webex = Webex.init({
    config: webexConfig
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

function toggleIfQueueConsultEnabled () {
  document.querySelectorAll('option[value="queue"]').forEach(item => {
    if(webex && !webex.cc.agentConfig.allowConsultToQueue) item.style.display = 'none';
    else item.style.display = 'block';
  });
}

const taskEvents = new CustomEvent('task:incoming', {
  detail: {
    task: currentTask,
  },
});

function updateButtonsPostEndCall() {
  // Button states come from task.uiControls - just update the UI
  if (currentTask) {
    updateCallControlUI(currentTask);
  } else {
    // No task - apply default (all disabled) controls
    applyAllControlsFromUIControls(null);
  }
}

function showInitiateConsultDialog() {
  initiateConsultDialog.showModal();
}

function closeConsultDialog() {
  initiateConsultDialog.close();
}

async function getQueueListForTelephonyChannel() {
  try {
    // Need to access via data as that is the list of queues
    const queueResponse = await webex.cc.getQueues();
    let queueList = queueResponse.data;
    queueList = queueList.filter(queue => queue.channelType === 'TELEPHONY');
  
    return queueList;
  } catch (error) {
    console.log('Failed to fetch queue list', error);
  }
}

async function getEntryPoints() {
  try {
    const entryPoints = await webex.cc.getEntryPoints({page: 0, pageSize: 100});
    if (Array.isArray(entryPoints?.data)) return entryPoints.data;
    if (Array.isArray(entryPoints)) return entryPoints;

    return [];
  } catch (error) {
    console.log('Failed to fetch entry points', error);
    return [];
  }
}

async function getDialNumberEntries() {
  try {
    const addressBookEntries = await webex.cc.addressBook.getEntries();
    return addressBookEntries.data || [];
  } catch (error) {
    console.log('Failed to fetch address book entries', error);
    return [];
  }
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
  } else if (destinationTypeDropdown.value === 'queue') {
    async function refreshQueueListForConsult() {
      consultDestinationInput = document.createElement('select');
      consultDestinationInput.id = 'consultDestination';

      const queueList = await getQueueListForTelephonyChannel();
  
      if(queueList.length > 0) {
        // Make consultDestinationInput into a dropdown
        consultDestinationInput = document.createElement('select');
        consultDestinationInput.id = 'consultDestination';
  
        queueList.forEach((queue) => {
          const option = document.createElement('option');
          option.text = queue.name;
          option.value = queue.id;
          consultDestinationInput.appendChild(option);
        });
      } else {
        consultDestinationInput.disabled = true;
        consultDestinationInput.innerText = 'No queues available';
      }
    }

    await refreshQueueListForConsult();

    // Add a refresh button to refresh the queue list
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-queue-list';
    refreshButton.innerHTML = 'Refresh queue list <i class="fa fa-refresh"></i>';
    refreshButton.onclick = refreshQueueListForConsult;
    consultDestinationHolderElm.appendChild(refreshButton);
  } else if (destinationTypeDropdown.value === 'dialNumber') {
    async function refreshAddressBookForConsult() {
      const dialNumberEntries = await getDialNumberEntries();

      if (dialNumberEntries.length > 0) {
        consultDestinationInput = document.createElement('select');
        consultDestinationInput.id = 'consultDestination';
        consultDestinationInput.innerHTML = '';
        dialNumberEntries.forEach((entry) => {
          const option = document.createElement('option');
          option.value = entry.number;
          option.text = `${entry.name} (${entry.number})`;
          consultDestinationInput.appendChild(option);
        });
        const customOpt = document.createElement('option');
        customOpt.value = '__CUSTOM__';
        customOpt.text = 'Custom number…';
        consultDestinationInput.appendChild(customOpt);

        consultDestinationInput.onchange = () => {
          if (consultDestinationInput.value === '__CUSTOM__') {
            // Swap to input for free typing
            const replacement = document.createElement('input');
            replacement.type = 'text';
            replacement.id = 'consultDestination';
            replacement.placeholder = 'Enter Destination';
            consultDestinationHolderElm.replaceChild(replacement, consultDestinationInput);
            consultDestinationInput = replacement;
          }
        };
      } else {
        consultDestinationInput = document.createElement('input');
        consultDestinationInput.type = 'text';
        consultDestinationInput.id = 'consultDestination';
        consultDestinationInput.placeholder = 'Enter Destination';
      }
    }

    await refreshAddressBookForConsult();

    // Add a refresh button to refresh the address book list
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-address-book-list';
    refreshButton.innerHTML = 'Refresh address book <i class="fa fa-refresh"></i>';
    refreshButton.onclick = refreshAddressBookForConsult;
    consultDestinationHolderElm.appendChild(refreshButton);
  } else if (destinationTypeDropdown.value === 'entryPoint') {
    async function refreshEntryPointsForConsult() {
      const entryPoints = await getEntryPoints();
      consultDestinationInput = document.createElement('select');
      consultDestinationInput.id = 'consultDestination';
      consultDestinationInput.innerHTML = '';

      if (entryPoints.length > 0) {
        entryPoints.forEach((ep) => {
          const option = document.createElement('option');
          option.value = ep.id;
          option.text = `${ep.name} (${ep.id})`;
          consultDestinationInput.appendChild(option);
        });
      } else {
        consultDestinationInput.disabled = true;
        const option = document.createElement('option');
        option.value = '';
        option.text = 'No entry points available';
        consultDestinationInput.appendChild(option);
      }
    }

    await refreshEntryPointsForConsult();

    // Add a refresh button to refresh the entry points list
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-entry-points-list';
    refreshButton.innerHTML = 'Refresh entry points <i class="fa fa-refresh"></i>';
    refreshButton.onclick = refreshEntryPointsForConsult;
    consultDestinationHolderElm.appendChild(refreshButton);
  } else {
    // Make consultDestinationInput into a text input
    consultDestinationInput = document.createElement('input');
    consultDestinationInput.id = 'consultDestination';
    consultDestinationInput.placeholder = 'Enter Destination';

    // Remove any existing refresh buttons
    const existingRefreshButtons = consultDestinationHolderElm.querySelectorAll('button[id^="refresh-"]');
    existingRefreshButtons.forEach(button => button.remove());
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

    async function refreshBuddyAgentsForTransfer() {
      transferDestinationInput.innerHTML = '';
      const agentNodeList = await fetchBuddyAgentsNodeList();
      agentNodeList.forEach(n => { transferDestinationInput.appendChild(n) });
    }

    await refreshBuddyAgentsForTransfer();

    // Add a refresh button to refresh the buddy agents list for transfer
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-buddy-agents-for-transfer';
    refreshButton.innerHTML = 'Refresh agent list <i class="fa fa-refresh"></i>';
    refreshButton.onclick = refreshBuddyAgentsForTransfer;
    transferDestinationHolderElm.appendChild(refreshButton);
  } else if (document.querySelector('#transfer-destination-type').value === 'queue') {
    async function refreshQueueListForTransfer() {
      const queueList = await getQueueListForTelephonyChannel();
      if (queueList.length > 0) {
        // Make transferDestinationInput into a dropdown
        transferDestinationInput = document.createElement('select');
        transferDestinationInput.id = 'transfer-destination';

        queueList.forEach((queue) => {
          const option = document.createElement('option');
          option.text = queue.name;
          option.value = queue.id;
          transferDestinationInput.appendChild(option);
        });
      } else {
        transferDestinationInput = document.createElement('select');
        transferDestinationInput.id = 'transfer-destination';
        transferDestinationInput.disabled = true;
        const option = document.createElement('option');
        option.text = 'No queues available';
        transferDestinationInput.appendChild(option);
      }
    }

    await refreshQueueListForTransfer();

    // Add a refresh button to refresh the queue list for transfer
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-queue-list-for-transfer';
    refreshButton.innerHTML = 'Refresh queue list <i class="fa fa-refresh"></i>';
    refreshButton.onclick = refreshQueueListForTransfer;
    transferDestinationHolderElm.appendChild(refreshButton);
  } else if (document.querySelector('#transfer-destination-type').value === 'dialNumber') {
    // Free-type with datalist for address book numbers OR select when entries exist
    async function refreshAddressBookForTransfer() {
      const dialNumberEntries = await getDialNumberEntries();

      if (dialNumberEntries.length > 0) {
        transferDestinationInput = document.createElement('select');
        transferDestinationInput.id = 'transfer-destination';
        transferDestinationInput.innerHTML = '';
        dialNumberEntries.forEach((entry) => {
          const option = document.createElement('option');
          option.value = entry.number;
          option.text = `${entry.name} (${entry.number})`;
          transferDestinationInput.appendChild(option);
        });
        const customOpt = document.createElement('option');
        customOpt.value = '__CUSTOM__';
        customOpt.text = 'Custom number…';
        transferDestinationInput.appendChild(customOpt);

        transferDestinationInput.onchange = () => {
          if (transferDestinationInput.value === '__CUSTOM__') {
            const replacement = document.createElement('input');
            replacement.type = 'text';
            replacement.id = 'transfer-destination';
            replacement.placeholder = 'Enter destination';
            transferDestinationHolderElm.replaceChild(replacement, transferDestinationInput);
            transferDestinationInput = replacement;
          }
        };
      } else {
        transferDestinationInput = document.createElement('input');
        transferDestinationInput.type = 'text';
        transferDestinationInput.id = 'transfer-destination';
        transferDestinationInput.placeholder = 'Enter destination';
      }
    }

    await refreshAddressBookForTransfer();

    // Add a refresh button to refresh the address book list for transfer
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-address-book-for-transfer';
    refreshButton.innerHTML = 'Refresh address book <i class="fa fa-refresh"></i>';
    refreshButton.onclick = refreshAddressBookForTransfer;
    transferDestinationHolderElm.appendChild(refreshButton);
  } else if (document.querySelector('#transfer-destination-type').value === 'entryPoint') {
    async function refreshEntryPointsForTransfer() {
      const entryPoints = await getEntryPoints();

      transferDestinationInput = document.createElement('input');
      transferDestinationInput.type = 'text';
      transferDestinationInput.id = 'transfer-destination';
      transferDestinationInput.placeholder = 'Enter Entry Point ID';

      const dataListId = 'transfer-entrypoint-datalist';
      let dataList = transferDestinationHolderElm.querySelector(`#${dataListId}`);
      if (!dataList) {
        dataList = document.createElement('datalist');
        dataList.id = dataListId;
        transferDestinationHolderElm.appendChild(dataList);
      }
      dataList.innerHTML = '';
      entryPoints.forEach((ep) => {
        const option = document.createElement('option');
        option.value = ep.id;
        option.label = ep.name;
        dataList.appendChild(option);
      });
      transferDestinationInput.setAttribute('list', dataListId);
    }

    await refreshEntryPointsForTransfer();

    // Add a refresh button to refresh the entry points list for transfer
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-entry-points-for-transfer';
    refreshButton.innerHTML = 'Refresh entry points <i class="fa fa-refresh"></i>';
    refreshButton.onclick = refreshEntryPointsForTransfer;
    transferDestinationHolderElm.appendChild(refreshButton);
  } else {
    // Make transferDestinationInput into a text input
    transferDestinationInput = document.createElement('input');
    transferDestinationInput.id = 'transfer-destination';
    transferDestinationInput.placeholder = 'Enter Destination';

    // Remove any existing refresh buttons
    const existingRefreshButtons = transferDestinationHolderElm.querySelectorAll('button[id^="refresh-"]');
    existingRefreshButtons.forEach(button => button.remove());
  }

  transferDestinationHolderElm.appendChild(transferDestinationInput);
}

// Function to initiate consult
async function initiateConsult() {
  const currentAgentId = webex?.cc?.taskManager?.getAgentId() || agentId;

  const destinationType = destinationTypeDropdown.value;
  const consultDestinationEl = consultDestinationHolderElm.querySelector('input, select');
  const consultDestination = consultDestinationEl && consultDestinationEl.value ? consultDestinationEl.value.trim() : '';

  if (!consultDestination) {
    alert('Please enter a destination');
    return;
  }

  closeConsultDialog();
  
  const consultPayload = {
    to: consultDestination,
    destinationType: destinationType,
  };

  if (destinationType === 'queue') {
    // Store consultation data for queue consult (reuse currentAgentId)
    consultationData = {
      to: consultDestination,
      destinationType: destinationType,
      consultingAgentId: currentAgentId, // Current agent ID (the one initiating the consult) from SDK
      consultedAgentId: consultDestination, // The queue being consulted
      isConsultedAgent: false // This agent is the consulting one, not the consulted one
    };
    handleQueueConsult(consultPayload);
    return;
  }

  // Store consultation data for the agent who initiated the consult (reuse currentAgentId)
  consultationData = {
    to: consultDestination,
    destinationType: destinationType,
    consultingAgentId: currentAgentId, // Current agent ID (the one initiating the consult) from SDK
    consultedAgentId: consultDestination, // The agent being consulted
    isConsultedAgent: false // This agent is the consulting one, not the consulted one
  };

  try {
    await currentTask.consult(consultPayload);
    console.log('Consult initiated successfully');
  } catch (error) {
    console.error('Failed to initiate consult', error);
    alert('Failed to initiate consult');
  }
}

async function handleQueueConsult(consultPayload) {
  // Update UI immediately
  currentConsultQueueId = consultPayload.to;
  endConsultBtn.innerText = 'Cancel Consult';
  
  try {
    await currentTask.consult(consultPayload);
    endConsultBtn.innerText = 'End Consult';
    currentConsultQueueId = null;
    console.log('Queue Consult initiated successfully');
  } catch (error) {
    console.error('Failed to initiate queue consult', error);
    alert('Failed to initiate queue consult');
    // Restore UI state
    currentConsultQueueId = null;
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
    await currentTask.transfer(transferPayload);
    console.log('Transfer initiated successfully');
    transferOptionsElm.style.display = 'none';
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
    if (currentTask.data.isConferenceInProgress) {
      await currentTask.transferConference();
    } else {
      await currentTask.transfer(consultTransferPayload);
      console.log('Consult/regular transfer initiated successfully');
    }
  } catch (error) {
    console.error('Failed to initiate consult transfer', error);
  }
}

async function toggleTransferOptions() {
  if (!currentTask) return;

  const interactionState = currentTask.data?.interaction?.state;
  const controls = getActiveUIControls(currentTask);
  const inConferenceFlow =
    interactionState === 'conference' || currentTask.data?.isConferenceInProgress === true;
  const inConsultFlow =
    interactionState === 'consulting' ||
    controls.endConsult?.isVisible ||
    controls.switch?.isVisible ||
    controls.conference?.isVisible;

  // In consult/conference/switched flows, transfer button should execute transfer API directly.
  if (inConferenceFlow || inConsultFlow) {
    try {
      if (inConferenceFlow && typeof currentTask.transferConference === 'function') {
        await currentTask.transferConference();
        console.log('Conference transfer initiated successfully');

        return;
      }

      console.log('pkesari_currentTask.data', currentTask.data);
      const transferTo = currentTask.data?.destAgentId || currentTask.data?.consultingAgentId;
      const transferDestinationType = currentTask.data?.destinationType || 'agent';

      if (!transferTo) {
        alert('Consult transfer is not ready yet. Wait for consult agent to join.');

        return;
      }

      await currentTask.transfer({
        to: transferTo,
        destinationType: transferDestinationType,
      });
      console.log('Consult transfer initiated successfully');

      return;
    } catch (error) {
      console.error('Direct transfer failed:', error);
      alert(`Transfer failed. ${error.message || 'Please try again.'}`);

      return;
    }
  }

  // Regular flow (normal consulted/general transfer): show transfer popover
  const transferOptions = document.getElementById('transfer-options');
  if (transferOptions.style.display === 'none') {
    transferOptions.style.display = 'block';
    onTransferTypeSelectionChanged();
  } else {
    transferOptions.style.display = 'none';
  }
}

// Function to end consult
async function endConsult() {
  const taskId = currentTask.data?.interactionId;

  const consultEndPayload = currentConsultQueueId ? {
    isConsult: true,
    taskId: taskId,
    queueId: currentConsultQueueId,
  } : 
  {
    isConsult: true,
    taskId: taskId,
  };

  try {
    await currentTask.endConsult(consultEndPayload);
    console.log('Consult ended successfully');
  } catch (error) {
    console.error('Failed to end consult', error);
    alert('Failed to end consult');
  }
}

/**
 * Gets the count of active agent participants in the conference
 * Iterates over ALL participants in interaction.participants (not just media participants)
 * to ensure we count all agents regardless of which media entry they appear in.
 * 
 * @param {Object} task - The task object containing interaction details
 * @returns {number} Number of active agent participants
 */
function getActiveAgentCount(task) {
  if (!task?.data?.interaction) return 0;
  
  const participants = task.data.interaction.participants || {};

  let agentCount = 0;
  Object.values(participants).forEach((participant) => {
    if (
      participant &&
      participant.pType !== 'Customer' &&
      participant.pType !== 'Supervisor' &&
      participant.pType !== 'VVA' &&
      !participant.hasLeft
    ) {
      agentCount++;
    }
  });

  return agentCount;
}

// MPC: Update participant list display
// Shows ALL other agents in the conference by iterating over interaction.participants
// This ensures we display all agents regardless of which media entry they appear in
function updateParticipantList(task) {
  if (!task || !task.data || !task.data.interaction) {
    participantListElm.style.display = 'none';
    return;
  }
  
  const { participants, owner } = task.data.interaction;
  
  // Count all active agents (not just from media participants)
  const activeAgentCount = getActiveAgentCount(task);
  
  // Debug logging to help troubleshoot participant list issues
  console.log('[updateParticipantList] Debug:', {
    interactionId: task.data.interactionId,
    mainInteractionId: task.data.interaction.mainInteractionId,
    activeAgentCount,
    allParticipants: Object.keys(participants || {}),
    allParticipantsDetails: Object.entries(participants || {}).map(([id, p]) => ({
      id: id.substring(0, 8),
      pType: p.pType,
      name: p.name,
      hasLeft: p.hasLeft,
      hasJoined: p.hasJoined
    })),
    mediaKeys: Object.keys(task.data.interaction.media || {})
  });
  
  // Only show participant list during actual conference (not consulting)
  // exitConference is only visible in CONFERENCING state
  const isConferenceActive = 
    task.uiControls?.exitConference?.isVisible || 
    task.uiControls?.exitConference?.isEnabled;
    
  if (isConferenceActive) {
    let participantHtml = '<strong>📋 Conference Participants:</strong><br/>';
    
    // Show conference info
    participantHtml += `<small>Agents: ${activeAgentCount}/7`;
    if (owner) {
      const ownerParticipant = participants[owner];
      const ownerName = ownerParticipant?.name || owner.substring(0, 8);
      participantHtml += ` | Owner: ${ownerName}`;
      
      // Show if current agent is the primary owner
      if (owner === agentId) {
        participantHtml += ' (You)';
      }
    }
    participantHtml += '</small><br/><br/>';
    
    // Iterate over ALL participants in interaction.participants
    // This ensures we show all agents regardless of media entry
    Object.entries(participants).forEach(([participantId, participant]) => {
      if (!participant) return;
      
      // Don't show the current agent in the list (they know they're in the call)
      if (participantId === agentId) return;
      
      // Only show agents (exclude Customer, Supervisor, VVA)
      if (
        participant.pType === 'Customer' ||
        participant.pType === 'Supervisor' ||
        participant.pType === 'VVA'
      ) {
        return;
      }
      
      // Don't show participants who have left
      if (participant.hasLeft) return;
      
      const role = participant.pType || 'Agent';
      const name = participant.name || participantId.substring(0, 8);
      const status = participant.hasJoined !== false ? '✅' : '⏳';
      const isOwner = participantId === owner ? ' 👑' : '';
  
      participantHtml += `${status} ${role}: ${name}${isOwner}<br/>`;
    });
    
    participantListElm.innerHTML = participantHtml;
    participantListElm.style.display = 'block';
  } else {
    participantListElm.style.display = 'none';
  }
}

/**
 * Gets the count of active agent participants in the conference
 * Iterates over ALL participants in interaction.participants (not just media participants)
 * to ensure we count all agents regardless of which media entry they appear in.
 * 
 * Note: mainCallId parameter is kept for backward compatibility but is no longer used.
 * 
 * @param {Object} task - The task object containing interaction details
 * @param {string} mainCallId - (deprecated) The main call interaction ID - no longer used
 * @returns {number} Number of active agent participants
 */
function getActiveAgentCountFromMainCall(task, mainCallId) {
  // Delegate to the unified getActiveAgentCount function
  return getActiveAgentCount(task);
}

/**
 * Merge consultation into conference
 * Called when the Merge button is clicked during CONSULTING state
 */
async function mergeToConference() {
  if (!currentTask) {
    alert('No active task');
    return;
  }

  try {
    console.log('Merging consultation into conference...');
    await currentTask.consultConference();
    console.log('Conference merge operation completed successfully');
  } catch (error) {
    console.error('Failed to merge to conference:', error);
    alert(`Failed to merge to conference. ${error.message || 'Please try again.'}`);
  }
}

/**
 * Exit from an active conference
 * Called when the Exit Conference button is clicked during CONFERENCING state
 */
async function exitConference() {
  if (!currentTask) {
    alert('No active task');
    return;
  }

  try {
    console.log('Exiting conference...');
    await currentTask.exitConference();
    console.log('Conference exited successfully');
  } catch (error) {
    console.error('Failed to exit conference:', error);
    alert(`Failed to exit conference. ${error.message || 'Please try again.'}`);
  }
}

/**
 * Legacy: Toggle conference action (kept for backward compatibility with conferenceToggleBtn)
 * Note: #conference-toggle does not exist in the HTML. The merge-conference button is used instead.
 */
async function toggleConference() {
  await mergeToConference();
}

// Function to transfer conference ownership
async function transferConference() {
  if (!currentTask) {
    alert('No active task');
    return;
  }

  try {
    console.log('Transferring conference...');
    await currentTask.transferConference();
    console.log('Conference transferred successfully');
  } catch (error) {
    console.error('Failed to transfer conference:', error);
    alert(`Failed to transfer conference. ${error.message || 'Please try again.'}`);
  }
}

/**
 * Switch between main and consult call
 */
async function switchCall() {
  if (!currentTask) {
    alert('No active task');
    return;
  }

  try {
    console.log('Switching call...');
    await currentTask.switchCall();
    console.log('Switched call successfully');
  } catch (error) {
    console.error('Failed to switch call:', error);
    alert(`Failed to switch call. ${error.message || 'Please try again.'}`);
  }
}

async function switchToMainCall() {
  return switchCall();
}

async function switchToConsult() {
  return switchCall();
}

// Update task state display in the UI
function updateTaskStateDisplay(task) {
  if (!task || !task.data) return;
  
  const interaction = task.data.interaction;
  const interactionState = interaction?.state || 'unknown';
  const isConference = task.data.isConferenceInProgress;
  const consultStatus = getConsultStatus(task);
  const owner = interaction?.owner;
  const isPrimary = owner === agentId;
  
  let stateText = `State: ${interactionState}`;
  
  if (isConference) {
    stateText += ' | 🎤 Conference Active';
  }
  
  if (consultStatus && consultStatus !== 'connected') {
    stateText += ` | Consult: ${consultStatus}`;
  }
  
  if (isPrimary) {
    stateText += ' | 👑 Primary';
  }
  
  // Update the incoming details element with state info when not incoming
  const isNew = isIncomingTask(task, agentId);
  if (!isNew && incomingDetailsElm) {
    const callerDisplay = task.data.interaction?.callAssociatedDetails?.ani || 'Unknown';
    incomingDetailsElm.innerText = `${callerDisplay} - ${stateText}`;
  }
}

// Function to load outdial ANI entries
async function loadOutdialAniEntries(outdialANIId) {

  try {
    console.log('Using outdial ANI ID:', outdialANIId);
    // Call the getOutdialAniEntries method from the SDK
    const aniResponse = await webex.cc.getOutdialAniEntries({
      outdialANI: outdialANIId
    });
    console.log('The request to get outdial ANI entries was successful, the response is:', aniResponse)

    // Clear existing options except the first one
    outdialAniSelectElm.innerHTML = '<option value="">Select Outdial Ani...</option>';

    // Get the ANI list from the response - it's directly an array
    const aniList = aniResponse || [];
    if (aniList.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.text = 'No ANI numbers available';
      option.disabled = true;
      outdialAniSelectElm.add(option);
      console.log('No outdial ANI entries found');
      return;
    }

    // Map and populate the select with ANI options
    aniList.forEach((ani) => {
      const option = document.createElement('option');
      option.value = ani.number;  // Use number as value
      option.text = ani.name;     // Use name as display text
      outdialAniSelectElm.add(option);
    });

    console.log(`Loaded ${aniList.length} outdial ANI entries`);

  } catch (error) {
    console.log('Failed to load outdial ANI entries:', error);
    // Add error option to select
    outdialAniSelectElm.innerHTML = '<option value="">Select Caller ID...</option>';
    const errorOption = document.createElement('option');
    errorOption.value = '';
    errorOption.text = 'Error loading ANI numbers';
    errorOption.disabled = true;
    outdialAniSelectElm.add(errorOption);
  }
}
// Function to start an outdial call.
async function startOutdial() {

  const destination = document.getElementById('outBoundDialNumber').value;
  const selectedAni = outdialAniSelectElm.value;

  if (!destination || !destination.trim()) {
      alert('Destination number is required');
      return;
  }

  if (!entryPointId || !entryPointId.trim()) {
      alert('Entry Point ID is required for outdial');
      return;
  }

  try {
    console.log('Making an outdial call');
    console.log('Destination:', destination);
    console.log('Selected ANI:', selectedAni || 'None selected, using default ANI');
    
    // Use selected ANI as the origin parameter
    if (selectedAni) {
      await webex.cc.startOutdial(destination, selectedAni);
      console.log('Outdial call initiated successfully with ANI:', selectedAni);
    } else {
      await webex.cc.startOutdial(destination);
      console.log('Outdial call initiated successfully with default ANI');
    }
    
  } catch (error) {
    console.error('Failed to initiate outdial call', error);
    alert('Failed to initiate outdial call: ' + (error.message || error));
  }
}

// Campaign Preview Contact Functions

function getCampaignPreviewPayload() {
  const interactionId = document.getElementById('campaign-interaction-id').value.trim();
  const campaignId = document.getElementById('campaign-id').value.trim();
  console.log('[CampaignPreview] getCampaignPreviewPayload:', { interactionId, campaignId });
  if (!interactionId || !campaignId) {
    console.warn('[CampaignPreview] Missing required fields - interactionId:', interactionId, 'campaignId:', campaignId);
    alert('Interaction ID and Campaign ID are required');
    return null;
  }
  return { interactionId, campaignId };
}

function stopCampaignCountdown() {
  if (campaignCountdownInterval) {
    clearInterval(campaignCountdownInterval);
    campaignCountdownInterval = null;
  }
}

function formatCampaignCountdown(seconds) {
  if (seconds <= 0) return '00:00';
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function startCampaignCountdown(timeoutTimestamp) {
  stopCampaignCountdown();

  const timerSection = document.getElementById('campaign-timer-section');
  const countdownElm = document.getElementById('campaign-countdown');
  timerSection.style.display = 'block';

  function updateCountdown() {
    const now = Date.now();
    const diffMs = timeoutTimestamp - now;
    const remaining = diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;

    countdownElm.textContent = formatCampaignCountdown(remaining);
    countdownElm.style.color = remaining <= 10 ? '#d32f2f' : '#333';

    if (remaining <= 0) {
      stopCampaignCountdown();
      handleCampaignTimeout();
    }
  }

  updateCountdown();
  campaignCountdownInterval = setInterval(updateCountdown, 1000);
}

function handleCampaignTimeout() {
  console.log('[CampaignPreview] Countdown expired, autoAction:', campaignPreviewAutoAction);
  const statusElm = document.getElementById('campaign-preview-status');
  const acceptBtn = document.getElementById('acceptPreviewContact');
  const skipBtn = document.getElementById('skipPreviewContact');
  const removeBtn = document.getElementById('removePreviewContact');

  if (campaignPreviewAutoAction === 'SKIP') {
    statusElm.innerText = 'Timeout! Auto-SKIP triggered...';
    acceptBtn.disabled = true;
    skipBtn.disabled = true;
    removeBtn.disabled = true;
    skipPreviewContact();
  } else if (campaignPreviewAutoAction === 'REMOVE') {
    statusElm.innerText = 'Timeout! Auto-REMOVE triggered...';
    acceptBtn.disabled = true;
    skipBtn.disabled = true;
    removeBtn.disabled = true;
    removePreviewContact();
  } else if (campaignPreviewAutoAction === 'ACCEPT') {
    statusElm.innerText = 'Timeout! Auto-ACCEPT triggered...';
    skipBtn.disabled = true;
    removeBtn.disabled = true;
    acceptPreviewContact();
  } else {
    statusElm.innerText = 'Countdown expired (no auto-action configured)';
    acceptBtn.disabled = true;
    skipBtn.disabled = true;
    removeBtn.disabled = true;
  }
}

function updateCampaignPreviewButtons(cpd) {
  const skipAllowedElm = document.getElementById('campaign-skip-allowed');
  const removeAllowedElm = document.getElementById('campaign-remove-allowed');

  const skipDisabled = cpd?.campaignPreviewSkipDisabled === 'true';
  const removeDisabled = cpd?.campaignPreviewRemoveDisabled === 'true';

  // Show status but do NOT disable buttons — let the user attempt the action
  // so they can see the SDK error when the action is disabled.
  skipAllowedElm.textContent = skipDisabled ? 'No' : 'Yes';
  skipAllowedElm.style.color = skipDisabled ? '#d32f2f' : '#2e7d32';
  removeAllowedElm.textContent = removeDisabled ? 'No' : 'Yes';
  removeAllowedElm.style.color = removeDisabled ? '#d32f2f' : '#2e7d32';
}

function resetCampaignPreviewUI() {
  stopCampaignCountdown();
  campaignPreviewAutoAction = null;
  document.getElementById('campaign-timer-section').style.display = 'none';
  document.getElementById('campaign-countdown').textContent = '--:--';
  document.getElementById('campaign-auto-action').textContent = 'N/A';
  document.getElementById('campaign-skip-allowed').textContent = '--';
  document.getElementById('campaign-remove-allowed').textContent = '--';
  document.getElementById('acceptPreviewContact').disabled = false;
  document.getElementById('skipPreviewContact').disabled = false;
  document.getElementById('removePreviewContact').disabled = false;
}

function setupCampaignPreviewFromTask(task) {
  const cpd = task.data?.interaction?.callProcessingDetails || {};
  const timeoutTimestamp = cpd.campaignPreviewOfferTimeout;
  campaignPreviewAutoAction = cpd.campaignPreviewAutoAction || null;

  const autoActionElm = document.getElementById('campaign-auto-action');
  autoActionElm.textContent = campaignPreviewAutoAction || 'None';
  autoActionElm.style.color = campaignPreviewAutoAction ? '#1565c0' : '#555';

  updateCampaignPreviewButtons(cpd);

  if (timeoutTimestamp) {
    const ts = typeof timeoutTimestamp === 'string' ? parseInt(timeoutTimestamp, 10) : timeoutTimestamp;
    if (!isNaN(ts) && ts > Date.now()) {
      startCampaignCountdown(ts);
    } else {
      console.log('[CampaignPreview] Timeout already expired or invalid:', timeoutTimestamp);
      document.getElementById('campaign-countdown').textContent = '00:00';
      document.getElementById('campaign-timer-section').style.display = 'block';
    }
  } else {
    document.getElementById('campaign-timer-section').style.display = 'block';
    document.getElementById('campaign-countdown').textContent = 'No timeout';
  }
}

function onCampaignReservationReceived(task) {
  console.log('[CampaignPreview] === RESERVATION EVENT RECEIVED ===');
  console.log('[CampaignPreview] Task data:', JSON.stringify(task.data, null, 2));
  const interactionId = task.data?.interactionId || '';
  const campaignId = task.data?.campaignId || task.data?.interaction?.callProcessingDetails?.campaignId || '';
  console.log('[CampaignPreview] Resolved interactionId:', interactionId, 'campaignId (name):', campaignId);
  document.getElementById('campaign-interaction-id').value = interactionId;
  document.getElementById('campaign-id').value = campaignId;
  document.getElementById('campaign-preview-status').innerText = 'Campaign preview contact received!';

  resetCampaignPreviewUI();
  setupCampaignPreviewFromTask(task);
}

async function acceptPreviewContact() {
  const payload = getCampaignPreviewPayload();
  if (!payload) return;
  stopCampaignCountdown();
  console.log('[CampaignPreview] === ACCEPT PREVIEW CONTACT ===');
  console.log('[CampaignPreview] Sending payload:', JSON.stringify(payload));
  try {
    document.getElementById('acceptPreviewContact').disabled = true;
    document.getElementById('campaign-preview-status').innerText = 'Accepting preview contact...';
    const result = await webex.cc.acceptPreviewContact(payload);
    console.log('[CampaignPreview] Accept SUCCESS - result:', JSON.stringify(result, null, 2));
    document.getElementById('campaign-preview-status').innerText = 'Preview contact accepted!';
    document.getElementById('campaign-interaction-id').value = '';
    document.getElementById('campaign-id').value = '';
  } catch (error) {
    console.error('[CampaignPreview] Accept FAILED - error:', error);
    console.error('[CampaignPreview] Error message:', error.message);
    console.error('[CampaignPreview] Error details:', error.details);
    console.error('[CampaignPreview] Error stack:', error.stack);
    document.getElementById('campaign-preview-status').innerText = 'Accept failed: ' + (error.message || error);
  } finally {
    document.getElementById('acceptPreviewContact').disabled = false;
  }
}

async function skipPreviewContact() {
  const payload = getCampaignPreviewPayload();
  if (!payload) return;
  // Do NOT stop the countdown here — if the skip is not allowed, the timer
  // must keep running so the auto-action can still fire on timeout.
  // Consistent with Agent Desktop: timer runs independently of button clicks.
  console.log('[CampaignPreview] === SKIP PREVIEW CONTACT ===');
  console.log('[CampaignPreview] Sending payload:', JSON.stringify(payload));
  try {
    document.getElementById('skipPreviewContact').disabled = true;
    document.getElementById('campaign-preview-status').innerText = 'Skipping preview contact...';
    const result = await webex.cc.skipPreviewContact(payload);
    console.log('[CampaignPreview] Skip SUCCESS - result:', JSON.stringify(result, null, 2));
    stopCampaignCountdown(); // Only stop timer on success
    document.getElementById('campaign-preview-status').innerText = 'Preview contact skipped!';
    document.getElementById('campaign-interaction-id').value = '';
    document.getElementById('campaign-id').value = '';
  } catch (error) {
    console.error('[CampaignPreview] Skip FAILED - error:', error);
    console.error('[CampaignPreview] Error message:', error.message);
    console.error('[CampaignPreview] Error details:', error.details);
    document.getElementById('campaign-preview-status').innerText = 'Skip failed: ' + (error.message || error);
  } finally {
    document.getElementById('skipPreviewContact').disabled = false;
  }
}

async function removePreviewContact() {
  const payload = getCampaignPreviewPayload();
  if (!payload) return;
  // Do NOT stop the countdown here — if the remove is not allowed, the timer
  // must keep running so the auto-action can still fire on timeout.
  // Consistent with Agent Desktop: timer runs independently of button clicks.
  console.log('[CampaignPreview] === REMOVE PREVIEW CONTACT ===');
  console.log('[CampaignPreview] Sending payload:', JSON.stringify(payload));
  try {
    document.getElementById('removePreviewContact').disabled = true;
    document.getElementById('campaign-preview-status').innerText = 'Removing preview contact...';
    const result = await webex.cc.removePreviewContact(payload);
    console.log('[CampaignPreview] Remove SUCCESS - result:', JSON.stringify(result, null, 2));
    stopCampaignCountdown(); // Only stop timer on success
    document.getElementById('campaign-preview-status').innerText = 'Preview contact removed!';
    document.getElementById('campaign-interaction-id').value = '';
    document.getElementById('campaign-id').value = '';
  } catch (error) {
    console.error('[CampaignPreview] Remove FAILED - error:', error);
    console.error('[CampaignPreview] Error message:', error.message);
    console.error('[CampaignPreview] Error details:', error.details);
    document.getElementById('campaign-preview-status').innerText = 'Remove failed: ' + (error.message || error);
  } finally {
    document.getElementById('removePreviewContact').disabled = false;
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


function isInteractionOnHold(task) {
  if (!task || !task.data || !task.data.interaction) {
    return false;
  }
  const interaction = task.data.interaction;
  if (!interaction.media) {
    return false;
  }
  return Object.values(interaction.media).some((media) => media.isHold);
} 

function isTaskLegOnHold(task, leg = 'main') {
  const interaction = task?.data?.interaction;
  const media = interaction?.media;

  if (!interaction || !media) {
    return false;
  }

  const mediaResourceId = leg === 'consult'
    ? task?.data?.consultMediaResourceId
    : task?.data?.mediaResourceId;

  if (mediaResourceId && media[mediaResourceId]) {
    return Boolean(media[mediaResourceId].isHold);
  }

  return isInteractionOnHold(task);
}

// Register task listeners
function registerTaskListeners(task) {
  if (!task || registeredTaskListeners.has(task)) {
    return;
  }

  registeredTaskListeners.add(task);

  task.on('REAL_TIME_TRANSCRIPTION', (payload) => {
    console.info('Received real-time transcription:', payload);
    appendRealtimeTranscript(payload);
  });

  task.on('SUGGESTED_RESPONSE', (payload) => {
    console.info('Received suggested response:', payload);
    setAssistantRawOutput(payload);
    const eventData = payload?.data || payload;
    const data = eventData?.data?.suggestion ? eventData.data : eventData;

    if (data?.suggestion) {
      appendSuggestionCard(data, {keepListening: true});
    } else {
      aiAssistantListening = true;
      showListeningIndicator();
    }
  });

  task.on('task:assigned', (task) => {
    updateTaskList(); // Update the task list UI to have latest tasks
    console.info('Call has been accepted for task: ', task.data.interactionId);
    handleTaskSelect(task);
  });
  task.on('task:media', (track) => {
    document.getElementById('remote-audio').srcObject = new MediaStream([track]);
  });
  task.on('task:end', (endedTask) => {
    updateTaskList();
    // Log campaign preview fields so we can verify values are retained through task:end
    const cpd = endedTask?.data?.interaction?.callProcessingDetails || {};
    console.log('[CampaignPreview] task:end — campaign preview fields:', {
      campaignPreviewAutoAction: cpd.campaignPreviewAutoAction || 'N/A',
      campaignPreviewOfferTimeout: cpd.campaignPreviewOfferTimeout || 'N/A',
      campaignPreviewSkipDisabled: cpd.campaignPreviewSkipDisabled || 'N/A',
      campaignPreviewRemoveDisabled: cpd.campaignPreviewRemoveDisabled || 'N/A',
    });

    // Stop the countdown but keep displaying the last campaign values
    // (auto-action, skip/remove allowed) so the user can see the final state.
    stopCampaignCountdown();
    document.getElementById('campaign-preview-status').innerText = 'Campaign contact ended';
    document.getElementById('campaign-countdown').textContent = '00:00';

    // Update the campaign fields from the ended task so values are still visible
    updateCampaignPreviewButtons(cpd);
    const autoAction = cpd.campaignPreviewAutoAction || null;
    const autoActionElm = document.getElementById('campaign-auto-action');
    autoActionElm.textContent = autoAction || 'None';
    autoActionElm.style.color = autoAction ? '#1565c0' : '#555';

    // Disable action buttons since the contact has ended
    document.getElementById('acceptPreviewContact').disabled = true;
    document.getElementById('skipPreviewContact').disabled = true;
    document.getElementById('removePreviewContact').disabled = true;
  });

  task.on('task:hold', (updatedTask) => {
    console.info('[task:hold] Task held - updating UI');
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      currentTask = updatedTask || task;
      updateCallControlUI(currentTask);
      updateParticipantList(currentTask);
    }
    updateTaskList();
  });

  task.on('task:resume', (updatedTask) => {
    console.info('[task:resume] Task resumed - updating UI');
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      currentTask = updatedTask || task;
      updateCallControlUI(currentTask);
      updateParticipantList(currentTask);
    }
    updateTaskList();
  });
  task.on('task:ui-controls-updated', () => {
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      console.info('[task:ui-controls-updated] UI controls changed, updating UI');
      // Always apply the uiControls from SDK - the SDK handles terminal state detection
      // and returns all controls hidden when task is truly terminated
      updateCallControlUI(task);
      updateParticipantList(task);
    }
  });

  // Consult flows - update both task list AND call controls UI
  // Each handler receives the updated task and explicitly updates the UI
  task.on('task:consultCreated', (updatedTask) => {
    console.info('[task:consultCreated] Consult created - updating UI');
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      currentTask = updatedTask || task;
      updateCallControlUI(currentTask);
      updateParticipantList(currentTask);
    }
    updateTaskList();
  });

  task.on('task:offerConsult', (updatedTask) => {
    console.info('[task:offerConsult] Consult offer received - updating UI');
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      currentTask = updatedTask || task;
      updateCallControlUI(currentTask);
      updateParticipantList(currentTask);
    }
    updateTaskList();
  });

  task.on('task:consultAccepted', (updatedTask) => {
    console.info('[task:consultAccepted] Consult accepted - updating UI');
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      currentTask = updatedTask || task;
      updateCallControlUI(currentTask);
      updateParticipantList(currentTask);
    }
    updateTaskList();
  });

  task.on('task:consulting', (updatedTask) => {
    console.info('[task:consulting] Consulting state - updating UI');
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      currentTask = updatedTask || task;
      updateCallControlUI(currentTask);
      updateParticipantList(currentTask);
    }
    updateTaskList();
  });

  task.on('task:consultQueueCancelled', (updatedTask) => {
    console.info('[task:consultQueueCancelled] Consult queue cancelled - updating UI');
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      currentTask = updatedTask || task;
      updateCallControlUI(currentTask);
      updateParticipantList(currentTask);
    }
    updateTaskList();
  });

  task.on('task:consultEnd', (updatedTask) => {
    console.info('[task:consultEnd] Consult ended - updating UI');
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      const taskToUse = updatedTask || task;
      currentTask = taskToUse;
      
      // Apply uiControls - SDK handles what to show based on new state
      // (HELD for initiator, TERMINATED for consulted agent)
      if (taskToUse && taskToUse.uiControls) {
        updateCallControlUI(taskToUse);
        updateParticipantList(taskToUse);
      } else {
        // If no uiControls available, clear all (task likely terminated)
        applyAllControlsFromUIControls(null);
        participantListElm.style.display = 'none';
        incomingDetailsElm.innerText = 'No Incoming Tasks';
        currentTask = undefined;
      }
    }
    updateTaskList();
  });
  task.on('task:rejected', (reason) => {
    updateTaskList();
    console.info('Task is rejected with reason:', reason);
    showAgentStatePopup(reason);
  });

  task.on('task:outdialFailed', (reason) => {
    updateTaskList();
    console.info('Outdial failed with reason:', reason);
    showOutdialFailedPopup(reason);
  });

  task.on('task:switchCall', (updatedTask) => {
    console.info('[task:switchCall] Call switched - updating UI');
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      currentTask = updatedTask || task;
      updateCallControlUI(currentTask);
    }
    updateTaskList();
  });

  // task:wrapup - Task has entered WRAPPING_UP state (call ended, awaiting wrapup)
  // This is when the agent should see wrapup controls
  // NOTE: At this point, uiControls may not be updated yet (race condition with state machine)
  // The actual UI update happens via task:ui-controls-updated which fires after state settles
  task.on('task:wrapup', (updatedTask) => {
    console.info('📝 [task:wrapup] Task entering wrapup state - UI will update via task:ui-controls-updated');
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      currentTask = updatedTask || task;
      // Hide participant list since call has ended
      participantListElm.style.display = 'none';
      // Use setTimeout to let state machine settle, then update UI
      // This ensures uiControls reflects the WRAPPING_UP state
      setTimeout(() => {
        console.info('📝 [task:wrapup] Delayed UI update for wrapup controls');
        updateCallControlUI(currentTask);
      }, 0);
    }
    updateTaskList();
  });

  // task:wrappedup - Agent has completed wrapup, task is now COMPLETED
  task.on('task:wrappedup', (updatedTask) => {
    console.info('[task:wrappedup] Task wrapped up (COMPLETED) - updating UI');
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      currentTask = updatedTask || task;
      updateCallControlUI(currentTask);
      updateParticipantList(currentTask);
    }
    updateTaskList();
  });

  // Task termination - clean up UI controls
  // When task:end fires, the task is TERMINATED - ALWAYS clear all controls
  task.on('task:end', () => {
    console.info('🔚 Task ended (TERMINATED) - clearing ALL UI controls');

    // Clean up task creation time tracking
    taskCreationTimes.delete(task.data.interactionId);

    // If this is the current task, clear all controls
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      // Task ended - ALWAYS clear all controls (don't rely on uiControls)
      applyAllControlsFromUIControls(null);
      participantListElm.style.display = 'none';
      incomingDetailsElm.innerText = 'No Incoming Tasks';

      // Clear currentTask since task has ended
      currentTask = undefined;
      if (aiAssistantContentElm) aiAssistantContentElm.innerHTML = '';
      resetAssistantRawOutput();
    }
    updateTaskList();
  });
  task.on('task:wrappedup', updateTaskList); // Update the task list UI to have latest tasks

  // Conference event listeners - Simplified approach
  task.on('task:participantJoined', (updatedTask) => {
    console.info('🚀 Participant joined conference - updating UI');
    // Update current task reference with latest data
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      currentTask = updatedTask;
      updateCallControlUI(currentTask);
      updateParticipantList(currentTask);
    }
    updateTaskList();
  });

  task.on('task:participantLeft', (updatedTask) => {
    console.info('🔚 Participant left conference - updating UI');
    // Update current task reference with latest data
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      currentTask = updatedTask;
      updateCallControlUI(currentTask);
      updateParticipantList(currentTask);
      
      // Check if conference has ended (only 1 agent left)
      const mainCallId = updatedTask.data.interaction?.mainInteractionId || updatedTask.data.interactionId;
      const activeAgentCount = getActiveAgentCountFromMainCall(updatedTask, mainCallId);
      console.info(`[task:participantLeft] Active agents remaining: ${activeAgentCount}`);
      
      // If only 1 agent remains, update UI to regular call state
      if (activeAgentCount <= 1) {
        console.info('📞 Conference ended - only 1 agent remaining, switching to regular call UI');
        participantListElm.style.display = 'none';
      }
    }
    updateTaskList();
  });

  // Campaign preview event listeners
  task.on('task:campaignContactUpdated', (updatedTask) => {
    console.log('[CampaignPreview] Campaign contact updated (next contact after skip/remove)');
    const cpd = updatedTask.data?.interaction?.callProcessingDetails || {};
    console.log('[CampaignPreview] task:campaignContactUpdated — campaign preview fields:', {
      campaignPreviewAutoAction: cpd.campaignPreviewAutoAction || 'N/A',
      campaignPreviewOfferTimeout: cpd.campaignPreviewOfferTimeout || 'N/A',
      campaignPreviewSkipDisabled: cpd.campaignPreviewSkipDisabled || 'N/A',
      campaignPreviewRemoveDisabled: cpd.campaignPreviewRemoveDisabled || 'N/A',
    });
    const interactionId = updatedTask.data?.interactionId || '';
    const campaignId = updatedTask.data?.campaignId || updatedTask.data?.interaction?.callProcessingDetails?.campaignId || '';
    document.getElementById('campaign-interaction-id').value = interactionId;
    document.getElementById('campaign-id').value = campaignId;
    document.getElementById('campaign-preview-status').innerText = 'New campaign contact received!';
    resetCampaignPreviewUI();
    setupCampaignPreviewFromTask(updatedTask);
  });

  task.on('task:campaignPreviewAcceptFailed', (failedTask) => {
    console.error('[CampaignPreview] Accept failed event received');
    document.getElementById('campaign-preview-status').innerText = 'Accept failed!';
    const cpd = failedTask.data?.interaction?.callProcessingDetails || {};
    updateCampaignPreviewButtons(cpd);
    document.getElementById('acceptPreviewContact').disabled = false;
  });

  task.on('task:campaignPreviewSkipFailed', (failedTask) => {
    console.error('[CampaignPreview] Skip failed event received');
    document.getElementById('campaign-preview-status').innerText = 'Skip failed!';
    const cpd = failedTask.data?.interaction?.callProcessingDetails || {};
    updateCampaignPreviewButtons(cpd);
    document.getElementById('acceptPreviewContact').disabled = false;
  });

  task.on('task:campaignPreviewRemoveFailed', (failedTask) => {
    console.error('[CampaignPreview] Remove failed event received');
    document.getElementById('campaign-preview-status').innerText = 'Remove failed!';
    const cpd = failedTask.data?.interaction?.callProcessingDetails || {};
    updateCampaignPreviewButtons(cpd);
    document.getElementById('acceptPreviewContact').disabled = false;
  });

  // Conference ended event - conference is over, but call may continue as regular call
  // This happens when agents leave and <2 agents remain, downgrading to CONNECTED state
  task.on('task:conferenceEnded', (updatedTask) => {
    console.info('🔚 Conference ended event - updating UI (call may continue as regular call)');
    if (currentTask && currentTask.data.interactionId === task.data.interactionId) {
      const taskToUse = updatedTask || task;
      
      // Update task reference and UI - call may still be active!
      currentTask = taskToUse || currentTask;
      if (currentTask.uiControls) {
        updateCallControlUI(currentTask);
      }
      
      // Hide participant list since conference ended
      participantListElm.style.display = 'none';
    }
    updateTaskList();
  });

  // Exit conference event - THIS agent is INITIATING exit from conference
  // This fires BEFORE the state transition completes (at EXIT_CONFERENCE event, not EXIT_CONFERENCE_SUCCESS)
  // Don't clear UI here - let task:wrapup or task:end handle the final UI state
  task.on('task:exitConference', (updatedTask) => {
    console.info('👋 [task:exitConference] Agent initiating conference exit - waiting for result...');
    // Just log and update task list - the actual UI update happens on:
    // - task:wrapup (if wrapUpRequired=true → WRAPPING_UP state)
    // - task:end (if wrapUpRequired=false → TERMINATED state)
    updateTaskList();
  });
}

/**
 * Checks if the current agent is a secondary agent in a consultation scenario.
 * Secondary agents are those who were consulted (not the original call owner).
 * @param {Object} task - The task object containing interaction details
 * @returns {boolean} True if this is a secondary agent (consulted party)
 */
function isSecondaryAgent(task) {
  const interaction = task.data.interaction;

  return (
    interaction.callProcessingDetails.relationshipType === 'consult' &&
    interaction.callProcessingDetails.parentInteractionId &&
    interaction.callProcessingDetails.parentInteractionId !== interaction.interactionId
  );
}

/**
 * Checks if the current agent is a secondary EP-DN (Entry Point Dial Number) agent.
 * This is specifically for telephony consultations to external numbers/entry points.
 * @param {Object} task - The task object containing interaction details
 * @returns {boolean} True if this is a secondary EP-DN agent in telephony consultation
 */
function isSecondaryEpDnAgent(task) {
  return task.data.interaction.mediaType === 'telephony' && isSecondaryAgent(task);
}

function getConsultMPCState(task, agentId) {
  const interaction = task.data.interaction;
  if (
    !!task.data.consultMediaResourceId &&
    !!interaction.participants[agentId]?.consultState &&
    task.data.interaction.state !== 'wrapUp' &&
    task.data.interaction.state !== 'post_call' // If interaction.state is post_call, we want to return post_call.
  ) {
    // interaction state for all agents when consult is going on
    switch (interaction.participants[agentId]?.consultState) {
      case 'consultInitiated':
        return 'consult';
      case 'consultCompleted':
        return interaction.state === 'connected' ? 'connected' : 'consultCompleted';
      case 'conferencing':
        return 'conference';
      default:
        return 'consulting';
    }
  }

  return interaction?.state;
}

function getTaskStatus(task, agentId) {
  const interaction = task.data.interaction;
  if (isSecondaryEpDnAgent(task)) {
    if (interaction.state === 'conference') {
      return 'conference';
    }
    return 'consulting'; // handle state of child agent case as we cant rely on interaction state.
  }
  if (
    (task.data.interaction.state === 'wrapUp' ||
      task.data.interaction.state === 'post_call') &&
    interaction.participants[agentId]?.consultState === 'consultCompleted'
  ) {
    return 'consultCompleted';
  }

  return getConsultMPCState(task, agentId);
}

function getConsultStatus(task) {
  if (!task || !task.data) {
    return 'No consultation in progress';
  }

  const state = getTaskStatus(task, agentId);
  
  const { interaction } = task.data;
  const taskState = interaction?.state;
  const participants = interaction?.participants || {};
  const participant = Object.values(participants).find(p => p.pType === 'Agent' && p.id === agentId);
  
  if (state === 'consult') {
    if ((participant && participant.isConsulted )|| isSecondaryEpDnAgent(task)) {
      return 'beingConsulted';
    }
    return 'consultInitiated';
  } else if (state === 'consulting') {
    if ((participant && participant.isConsulted) || isSecondaryEpDnAgent(task)) {
      return 'beingConsultedAccepted';
    }
    return 'consultAccepted';
  } else if (state === 'connected') {
    return 'connected';
  } else if (state === 'conference') {
    return 'conference';
  } else if (state === 'consultCompleted') {
    return taskState === 'connected' ? 'connected' : taskState;
  }

  return 'connected';
}

/**
 * Update call control UI based ONLY on task.uiControls
 * 
 * IMPORTANT: This is the SINGLE source of truth for all call control button states.
 * All button visibility and enabled states come from task.uiControls.
 * DO NOT manually set .disabled or .style.display anywhere else!
 */
function getTaskLegControls(task, leg) {
  if (!task?.uiControls) {
    return null;
  }

  if (!task.uiControls.main) {
    return task.uiControls;
  }

  return leg === 'consult' ? task.uiControls.consult : task.uiControls.main;
}

function getTaskActiveLeg(task) {
  return task?.uiControls?.activeLeg || 'main';
}

function getActiveUIControls(task) {
  return getTaskLegControls(task, getTaskActiveLeg(task)) || {};
}

function hasVisibleControls(controls) {
  if (!controls) return false;

  return Object.values(controls).some((control) => control?.isVisible);
}

function getTaskControlCardStatus(task, leg) {
  const activeLeg = getTaskActiveLeg(task);

  if (leg === 'consult') {
    return activeLeg === 'consult' ? 'Consulting' : 'On Hold';
  }

  if (hasVisibleControls(task?.uiControls?.consult)) {
    return activeLeg === 'main' ? 'Connected' : 'On Hold';
  }

  return task?.data?.interaction?.state || 'Unknown';
}

function getTaskControlCardLabel(task, leg, actionKey) {
  if (actionKey === 'hold') {
    return isTaskLegOnHold(task, leg) ? 'Resume' : 'Hold';
  }

  if (actionKey === 'switch') {
    return 'Switch';
  }

  if (actionKey === 'conference') {
    return leg === 'consult' ? 'Merge' : 'Conference';
  }

  return {
    mute: 'Mute',
    consult: 'Consult',
    transfer: 'Transfer',
    endConsult: 'End Consult',
    exitConference: 'Exit Conference',
    end: 'End',
    wrapup: 'Wrapup',
    recording: 'Recording',
  }[actionKey] || actionKey;
}

function executeTaskControlCardAction(task, actionKey) {
  if (!task) return;

  currentTask = task;

  const actionMap = {
    hold: () => holdResumeCall(),
    mute: () => muteUnmute(),
    consult: () => showInitiateConsultDialog(),
    transfer: () => toggleTransferOptions(),
    conference: () => mergeToConference(),
    endConsult: () => endConsult(),
    exitConference: () => exitConference(),
    switch: () => switchCall(),
    end: () => endCall(),
    wrapup: () => wrapupCall(),
  };

  actionMap[actionKey]?.();
}

function renderTaskControlsSections(task) {
  if (!taskControlsCardsElm) return;

  taskControlsCardsElm.innerHTML = '';

  if (!task?.uiControls?.main) {
    return;
  }

  const activeLeg = getTaskActiveLeg(task);
  const legs = [
    {id: 'main', title: 'Main Interaction', controls: getTaskLegControls(task, 'main')},
    {id: 'consult', title: 'Consult Interaction', controls: getTaskLegControls(task, 'consult')},
  ].filter((entry) => entry.id === 'main' || hasVisibleControls(entry.controls));

  const actionOrder = [
    'hold',
    'mute',
    'consult',
    'transfer',
    'conference',
    'endConsult',
    'exitConference',
    'switch',
    'end',
    'wrapup',
  ];

  legs.forEach(({id, title, controls}) => {
    const isActive = id === activeLeg;
    const card = document.createElement('section');
    card.className = `task-controls-card${isActive ? ' is-active' : ''}`;

    const header = document.createElement('div');
    header.className = 'task-controls-card__header';

    const titleElm = document.createElement('div');
    titleElm.className = 'task-controls-card__title';
    titleElm.textContent = title;

    const badgeElm = document.createElement('span');
    badgeElm.className = 'task-controls-card__badge';
    badgeElm.textContent = isActive ? 'Active' : 'Inactive';

    header.appendChild(titleElm);
    header.appendChild(badgeElm);

    const metaElm = document.createElement('div');
    metaElm.className = 'task-controls-card__meta';
    metaElm.textContent = `State: ${getTaskControlCardStatus(task, id)}`;

    const actionsElm = document.createElement('div');
    actionsElm.className = 'task-controls-card__actions';

    actionOrder.forEach((actionKey) => {
      const control = controls?.[actionKey];

      if (!control?.isVisible) {
        return;
      }

      if (!isActive && actionKey === 'switch') {
        return;
      }

      const button = document.createElement('button');
      button.textContent = getTaskControlCardLabel(task, id, actionKey);
      const allowInactiveAction = actionKey === 'endConsult';

      button.disabled = (!isActive && !allowInactiveAction) || !control.isEnabled;
      button.addEventListener('click', () => executeTaskControlCardAction(task, actionKey));
      actionsElm.appendChild(button);
    });

    card.appendChild(header);
    card.appendChild(metaElm);
    card.appendChild(actionsElm);
    taskControlsCardsElm.appendChild(card);
  });
}

function updateCallControlUI(task) {
  if (!task) {
    // No task - hide all call controls
    applyAllControlsFromUIControls(null);
    renderTaskControlsSections(null);
    return;
  }

  const { data } = task;
  const { interaction } = data;
  const { callProcessingDetails } = interaction || {};

  // Get uiControls from task - this is the SINGLE SOURCE OF TRUTH
  const uiControls = getActiveUIControls(task);

  // Apply ALL button states from uiControls
  applyAllControlsFromUIControls(uiControls);
  renderTaskControlsSections(task);

  // Update button text based on state (text only, not visibility/enabled)
  updateButtonLabels(task, callProcessingDetails);

  // Handle auto-wrapup timer display
  handleAutoWrapupDisplay(task);

  // Update task state display
  updateTaskStateDisplay(task);

  // Update incoming call display for new tasks
  updateIncomingCallDisplay(task);

  // Update participant list display
  updateParticipantList(task);

  // Debug logging
  console.log('uiControls applied:', {
    interactionId: task.data?.interactionId,
    activeLeg: task.uiControls?.activeLeg,
    accept: uiControls.accept,
    decline: uiControls.decline,
    hold: uiControls.hold,
    mute: uiControls.mute,
    consult: uiControls.consult,
    transfer: uiControls.transfer,
    end: uiControls.end,
    conference: uiControls.conference,
    mergeToConference: uiControls.mergeToConference,
    exitConference: uiControls.exitConference,
    switch: uiControls.switch,
    wrapup: uiControls.wrapup,
  });
}

/**
 * Apply control state to a single element from uiControls
 * This is the ONLY function that should set .style.display and .disabled
 */
function applyControlState(element, control) {
  if (!element) return;
  
  // Default to hidden and disabled if no control provided
  const isVisible = control?.isVisible ?? false;
  const isEnabled = control?.isEnabled ?? false;
  
  element.style.display = isVisible ? 'inline-block' : 'none';
  element.disabled = !isEnabled;
}

/**
 * Apply ALL call control button states from uiControls
 * This is the SINGLE place where button visibility/enabled is set
 */
function applyAllControlsFromUIControls(uiControls) {
  const controls = uiControls || {};
  
  // Accept/Decline buttons
  applyControlState(answerElm, controls.accept);
  applyControlState(declineElm, controls.decline);
  
  // Core call controls
  applyControlState(holdResumeElm, controls.hold);
  applyControlState(muteElm, controls.mute);
  applyControlState(consultTabBtn, controls.consult);
  applyControlState(transferElm, controls.transfer);
  applyControlState(endElm, controls.end);
  applyControlState(pauseResumeRecordingElm, controls.recording);
  
  // Consult controls
  applyControlState(endConsultBtn, controls.endConsult);
  applyControlState(consultTransferBtn, controls.consultTransfer);
  
  // Conference controls
  // Use mergeConferenceBtn for the unified conference control
  applyControlState(mergeConferenceBtn, controls.conference);
  applyControlState(exitConferenceBtn, controls.exitConference);
  applyControlState(transferConferenceBtn, controls.transferConference);
  applyControlState(switchToMainBtn, controls.switch);
  applyControlState(switchToConsultBtn, controls.switch);
  
  // Wrapup controls
  applyControlState(wrapupElm, controls.wrapup);
  if (wrapupCodesDropdownElm) {
    wrapupCodesDropdownElm.disabled = !(controls.wrapup?.isEnabled);
  }
}

/**
 * Update button labels/text based on task state
 * Only updates text, NOT visibility or enabled state
 */
function updateButtonLabels(task, callProcessingDetails) {
  if (!task) return;
  
  // Hold/Resume button text
  const isHold = isTaskLegOnHold(task, getTaskActiveLeg(task));
  if (holdResumeElm) {
    holdResumeElm.innerText = isHold ? 'Resume' : 'Hold';
  }
  
  // Recording button text
  if (pauseResumeRecordingElm && callProcessingDetails) {
    const { isPaused } = callProcessingDetails;
    pauseResumeRecordingElm.innerText = isPaused === 'true' ? 'Resume Recording' : 'Pause Recording';
  }
  
  // Consult button tooltip - shows participant limit info
  if (consultTabBtn) {
    const activeAgentCount = getActiveAgentCount(task);
    const hasReachedParticipantLimit = activeAgentCount >= 7;
    consultTabBtn.title = hasReachedParticipantLimit
      ? 'Maximum 7 participants allowed in conference'
      : 'Initiate consultation with another agent';
  }

  // Conference/Merge button label based on which leg is active
  if (mergeConferenceBtn) {
    const controls = getActiveUIControls(task);
    if (controls?.conference?.isVisible) {
      const onMainLeg = getTaskActiveLeg(task) === 'main';

      mergeConferenceBtn.innerText = onMainLeg ? 'Conference' : 'Merge';
    }
  }
}

/**
 * Handle auto-wrapup timer display
 */
function handleAutoWrapupDisplay(task) {
  if (!task) {
    if (autoWrapupTimerElm) autoWrapupTimerElm.style.display = 'none';
    return;
  }
  
  if (task.data?.wrapUpRequired && task.autoWrapup?.isRunning()) {
    startAutoWrapupTimer(task);
    if (autoWrapupTimerElm) autoWrapupTimerElm.style.display = 'block';
  } else {
    if (autoWrapupTimerElm) autoWrapupTimerElm.style.display = 'none';
  }
}

/**
 * Update incoming call display info
 */
function updateIncomingCallDisplay(task) {
  if (!task || !incomingDetailsElm) return;
  
  const isNew = isIncomingTask(task, agentId);
  if (!isNew) return;
  
  const callerDisplay = task.data.interaction?.callAssociatedDetails?.ani;
  const mediaType = task.data.interaction?.mediaType;
  
  if (mediaType === 'telephony') {
    if (agentDeviceType === 'BROWSER') {
      incomingDetailsElm.innerText = `Call from ${callerDisplay}`;
      if (task.data.isAutoAnswering) {
        console.log('✅ Auto-answer in progress for task:', task.data.interactionId);
      }
    } else {
      incomingDetailsElm.innerText = `Call from ${callerDisplay}...please answer on the endpoint where the agent's extension is registered`;
    }
  }
}

// Legacy function kept for compatibility
function makeDisabledAndHide(element, hide, disable) {
  if (!element) return;
  element.style.display = hide ? 'none' : 'inline-block';
  element.disabled = disable;
}

function generateWebexConfig({credentials}) {
  return {
    appName: 'sdk-samples',
    appPlatform: 'testClient',
    fedramp: false,
    logger: {
      level: 'info',
      bufferLogLevel: 'log',
    },
    cc: {
      allowMultiLogin: isMultiLoginEnabled,
      disableWebRTCRegistration: isWebRTCRegistrationDisabled,
    },
    credentials,
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

  if (!enableProd) {
     webexConfig.services = {
      discovery: {
        u2c: 'https://u2c-intb.ciscospark.com/u2c/api/v1',
      },
    };
  }

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
    // Dynamically add the IMI Engage controller bundle script
    initializeEngageWidget();
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

function updateUnregisterButtonState() {  
  const isLoggedIn = webex?.cc?.agentConfig?.isAgentLoggedIn || 
    !logoutAgentElm.classList.contains('hidden');
  
  deregisterBtn.disabled = isLoggedIn;  
}

let autoWrapupInterval;

function startAutoWrapupTimer(task) {
  if (!task || !task.autoWrapup || !task.autoWrapup.isRunning()) {
    return;
  }
  
  // Clear any existing interval
  if (autoWrapupInterval) {
    clearInterval(autoWrapupInterval);
  }
  
  // Show the timer element
  autoWrapupTimerElm.style.display = 'block';
  
  // Update timer value immediately
  const timeLeftInSeconds = task.autoWrapup.getTimeLeftSeconds();
  timerValueElm.textContent = formatTimeRemaining(timeLeftInSeconds);
  
  // Set up the interval to update every second
  autoWrapupInterval = setInterval(() => {
    if (task) {
      const remainingSeconds = task.autoWrapup?.getTimeLeftSeconds();
      timerValueElm.textContent = formatTimeRemaining(remainingSeconds);
      
      if (remainingSeconds <= 0) {
        clearInterval(autoWrapupInterval);
        autoWrapupTimerElm.style.display = 'none';
      }
    } else {
      // If auto wrapup is no longer running, clear the interval
      clearInterval(autoWrapupInterval);
      autoWrapupTimerElm.style.display = 'none';
    }
  }, 1000);
}

function formatTimeRemaining(seconds) {
  return seconds > 0 ? `${seconds}s` : '0s';
}

function register() {
    webex.cc.register().then((agentProfile) => {
        registerStatus.innerHTML = 'Subscribed';
        // Update button states upon successful registration
        registerBtn.disabled = true;
        deregisterBtn.disabled = false;
        uploadLogsButton.disabled = false;
        enableUserPreferenceButtons(true);
        updateUnregisterButtonState();
        console.log('Event subscription successful: ', agentProfile);
        teamsDropdown.innerHTML = ''; // Clear previously selected option on teamsDropdown
        const listTeams = agentProfile.teams;
        agentId = agentProfile.agentId;
        agentName = agentProfile.agentName;
        wrapupCodes = agentProfile.wrapupCodes;
        agentDeviceType = agentProfile.deviceType;
        populateWrapupCodesDropdown();
        outdialANIId = agentProfile.outdialANIId;
        loadOutdialAniEntries(agentProfile.outdialANIId).catch(error => {
            console.warn('Failed to load ANI entries during registration:', error);
        })

        listTeams.forEach((team) => {
            const option = document.createElement('option');
            option.value = team.id;
            option.text = team.name;
            teamsDropdown.add(option);
        });
        if (updateTeamDropdownElm) {
          updateTeamDropdownElm.innerHTML = teamsDropdown.innerHTML;
          updateTeamDropdownElm.value      = teamsDropdown.value;  // sync initial selection
        }
        // Keep both dropdowns in sync
        teamsDropdown.addEventListener('change', () => {
          if (updateTeamDropdownElm) {
            updateTeamDropdownElm.value = teamsDropdown.value;
          }
        });
        updateTeamDropdownElm.addEventListener('change', () => {
          teamsDropdown.value = updateTeamDropdownElm.value;
        });
        const loginVoiceOptions = agentProfile.loginVoiceOptions;
        populateLoginOptions(
          loginVoiceOptions.filter((o) => agentProfile.webRtcEnabled || o !== 'BROWSER')
        );
        dialNumber.value = agentProfile.dn ?? '';
        dialNumber.disabled = !agentProfile.dn;
        if (loginVoiceOptions.length > 0) loginAgentElm.disabled = false;

        if (agentProfile.isAgentLoggedIn) {
          loginAgentElm.disabled = true;
          logoutAgentElm.classList.remove('hidden');
          updateUnregisterButtonState();
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
        webex.cc.on('task:incoming', (task) => {
          console.log('Incoming task received: ', task);
          updateTaskList();
          taskId = task.data.interactionId;
          registerTaskListeners(currentTask);
        });

    webex.cc.on('task:hydrate', (currentTask) => {
      handleTaskHydrate(currentTask);
    });

    webex.cc.on('agent:stateChange', (data) => {
      if (data && typeof data === 'object' && data.type === 'AgentStateChangeSuccess') {
        console.log('Agent state change event received:', data.type);
        const DEFAULT_CODE = '0'; // Default code when no aux code is present
        idleCodesDropdown.value = data.auxCodeId?.trim() !== '' ? data.auxCodeId : DEFAULT_CODE;
        startStateTimer(data.lastStateChangeTimestamp, data.lastIdleCodeChangeTimestamp);
      }
    });

    webex.cc.on('task:campaignPreviewReservation', (data) => {
      onCampaignReservationReceived(data);
      updateTaskList();
      taskId = data.data.interactionId;
      registerTaskListeners(data);
    });

    webex.cc.on('agent:multiLogin', (data) => {
      if (data && typeof data === 'object' && data.type === 'AgentMultiLoginCloseSession') {
        agentMultiLoginAlert.innerHTML = 'Multiple Agent Login Session Detected!';  
        agentMultiLoginAlert.style.color = 'red';``
      }
    });

    webex.cc.on('agent:reloginSuccess', (data) => {
      console.log('Agent re-login successful', data);
      loginAgentElm.disabled = true;
      logoutAgentElm.classList.remove('hidden');
      updateAgentProfileElm.classList.remove('hidden');

      agentLogin.value = data.deviceType;
      agentDeviceType = data.deviceType;

      if (data.deviceType === 'BROWSER') {
        dialNumber.disabled = true;
        dialNumber.value = '';
      }
      else {
        dialNumber.disabled = false;
        dialNumber.value = data.dn || '';
      }
    });

    webex.cc.on('agent:stationLoginSuccess', (data) => {
      console.log('Agent station-login success', data);
      loginAgentElm.disabled = true;
      logoutAgentElm.classList.remove('hidden');
      updateAgentProfileElm.classList.remove('hidden');
      updateFieldsContainer.classList.add('hidden');

      agentLogin.value = data.deviceType;
      agentDeviceType = data.deviceType;
      if (data.deviceType === 'BROWSER') {
        dialNumber.disabled = true;
        dialNumber.value = '';
      }
      else {
        dialNumber.disabled = false;
        dialNumber.value = data.dn || '';
      }
      const auxId  = data.auxCodeId?.trim() || '0';
      const idx    = [...idleCodesDropdown.options].findIndex(o => o.value === auxId);
      idleCodesDropdown.selectedIndex = idx >= 0 ? idx : 0;
      startStateTimer(data.lastStateChangeTimestamp, data.lastIdleCodeChangeTimestamp);
    });
        updateTaskList();
    }).catch((error) => {
        console.error('Event subscription failed', error);
    })
}

// New function to handle unregistration
function doDeRegister() {
    webex.cc.deregister().then(() => {
        console.log('Deregistered successfully');
        registerStatus.innerHTML = 'Unregistered';
        // Reset button states after unregister
        registerBtn.disabled = false;
        deregisterBtn.disabled = true;
        uploadLogsButton.disabled = true;
        enableUserPreferenceButtons(false);
        
        // Clear all dropdowns that are populated during registration
        teamsDropdown.innerHTML = '';
        idleCodesDropdown.innerHTML = '';
        agentLogin.innerHTML = '<option value="" selected>Choose Agent Login ...</option>';
        
        // Clear timer display
        if (stateTimer) {
            clearInterval(stateTimer);
            stateTimer = null;
        }
        if (timerElm) {
            timerElm.innerHTML = '';
        }
        
        // Reset other elements
        dialNumber.value = '';
        dialNumber.disabled = true;
        loginAgentElm.disabled = true;
        setAgentStatusButton.disabled = true;
        
        // Hide logout button if visible
        logoutAgentElm.classList.add('hidden');
    }).catch((error) => {
        console.error('Unregister failed', error);
    });
}

deregisterBtn.addEventListener('click', doDeRegister);

function handleTaskHydrate(task) {
  currentTask = task;

  if (!currentTask || !currentTask.data || !currentTask.data.interaction) {
    console.error('task:hydrate --> No task data found.');
    alert('task:hydrate --> No task data found.');
    
    return;
  }

  handleTaskSelect(currentTask);
  updateUnregisterButtonState();
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
  agentLoginInputError.style.display = 'none';
  agentLoginGenericError.style.display = 'none';
  
  webex.cc.stationLogin({
    teamId: teamsDropdown.value,
    loginOption: agentDeviceType,
    dialNumber: dialNumber.value
  })
  .then((response) => {
    console.log('Agent Logged in successfully', response);
    loginAgentElm.disabled = true;
    logoutAgentElm.classList.remove('hidden');
    updateAgentProfileElm.classList.remove('hidden');
    // Read auxCode and lastStateChangeTimestamp from login response
    const DEFAULT_CODE = '0'; // Default code when no aux code is present
    const auxCodeId = response.auxCodeId?.trim() !== '' ? response.auxCodeId : DEFAULT_CODE;
    const lastStateChangeTimestamp = response.lastStateChangeTimestamp;
    const lastIdleCodeChangeTimestamp = response.lastIdleCodeChangeTimestamp;
    const index = [...idleCodesDropdown.options].findIndex(option => option.value === auxCodeId);
    idleCodesDropdown.selectedIndex = index !== -1 ? index : 0;
    startStateTimer(lastStateChangeTimestamp, lastIdleCodeChangeTimestamp);
    
  }).catch((error) => {
    console.log('Agent Login failed', error);
    if(['EXTENSION', 'AGENT_DN'].includes(error.data.fieldName))  {
      agentLoginInputError.innerText = error.data.message;
      agentLoginInputError.style.display = 'block';
    } else {
      agentLoginGenericError.innerText = error.data.message;
      agentLoginGenericError.style.display = 'block';
    }
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
    updateTaskList();
  }).catch(error => {
    console.error('Agent status set failed', error);
  });
}


function logoutAgent() {
  webex.cc.stationLogout({logoutReason: 'logout'})
    .then((response) => {
      console.log('Agent logged out successfully', response);
      loginAgentElm.disabled = false;
      updateAgentProfileElm.classList.add('hidden');
      updateFieldsContainer.classList.add('hidden');

     // Clear the timer when the agent logs out.
     if (stateTimer) {
      clearInterval(stateTimer);
      stateTimer = null;
    }

    // Reset UI elements.
    setTimeout(() => {
      logoutAgentElm.classList.add('hidden');
      agentLogin.selectedIndex = 0;
      timerElm.innerHTML = '00:00:00';
      
      // Clear outdial ANI select
      outdialAniSelectElm.innerHTML = '<option value="">Select Caller ID...</option>';
      
      updateUnregisterButtonState();
    }, 1000);
    
    // Add an immediate call to update button state
    updateUnregisterButtonState();
  }
  ).catch((error) => {
    console.log('Agent logout failed', error);
  });
}

async function applyupdateAgentProfile() {
  const loginOption = updateLoginOptionElm.value;
  const newDial = loginOption === 'BROWSER' ? '' : updateDialNumberElm.value;
  const payload = {
    teamId: updateTeamDropdownElm?.value || teamsDropdown.value,
    loginOption,
    dialNumber: newDial,
  };
  try {
    const resp = await webex.cc.updateAgentProfile(payload);
    console.log('Profile updated', resp);
    updateFieldsContainer.classList.add('hidden');
    // Reflect new values in main UI
    agentLogin.value = loginOption;
    agentDeviceType = loginOption;
    dialNumber.value = newDial;
    dialNumber.disabled = loginOption === 'BROWSER';
  }
  catch (err) {
    console.error('Profile update failed', err);
    alert('Profile update failed');
  }
}

function showupdateAgentProfileUI() {
  // ensure update dialog reflects current team
  if (updateTeamDropdownElm) {
    updateTeamDropdownElm.value = teamsDropdown.value;
  }
  updateFieldsContainer.classList.toggle('hidden');
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

function showOutdialFailedPopup(reason) {
  const outdialFailedReasonText = document.getElementById('outdialFailedReasonText');
  
  // Set the reason text based on the reason
  if (reason === 'CUSTOMER_BUSY') {
    outdialFailedReasonText.innerText = 'Customer is busy';
  } else if (reason === 'NO_ANSWER') {
    outdialFailedReasonText.innerText = 'No answer from customer';
  } else if (reason === 'CALL_FAILED') {
    outdialFailedReasonText.innerText = 'Call failed';
  } else if (reason === 'INVALID_NUMBER') {
    outdialFailedReasonText.innerText = 'Invalid phone number';
  } else {
    outdialFailedReasonText.innerText = `Outdial failed: ${reason}`;
  }

  const outdialFailedPopup = document.getElementById('outdialFailedPopup');
  outdialFailedPopup.classList.remove('hidden');
}

function closeOutdialFailedPopup() {
  const outdialFailedPopup = document.getElementById('outdialFailedPopup');
  outdialFailedPopup.classList.add('hidden');
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
  currentTask = event.detail.task;
  updateTaskList();
  taskId = event.detail.task.data.interactionId;

  registerTaskListeners(currentTask);
  // Update UI based on task.uiControls
  updateIncomingTaskDisplay(currentTask);
  updateCallControlUI(currentTask);
});

 async function answer() {
  // Button states will be updated by task.uiControls after accept() completes
  await currentTask.accept();
  updateTaskList();
  incomingDetailsElm.innerText = 'Task Accepted';
}

async function decline() {
  try {
    await currentTask.decline();
  } catch (e) {
    console.error('Decline failed', e);
  }
  incomingDetailsElm.innerText = 'No incoming Tasks';
  updateTaskList();
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
    tokenElm.disabled = true;
    saveElm.disabled = true;
    authStatusElm.innerText = 'Saved access token!';
    registerStatus.innerHTML = 'Not Subscribed';
    registerBtn.disabled = false;
    // Dynamically add the IMI Engage controller bundle script
    initializeEngageWidget();
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
  // Button states will be updated by task.uiControls after operation completes
  const isHold = holdResumeElm.innerText === 'Hold';
  currentTask.holdResume().then(() => {
    console.info(isHold ? 'Call held successfully' : 'Call resumed successfully');
    // UI will update via updateTaskList -> updateCallControlUI -> uiControls
    updateTaskList();
  }).catch((error) => {
    console.error('Failed to hold/resume the call', error);
    updateTaskList();
  });
}

function muteUnmute() {
  if (muteElm.innerText === 'Mute') {
    muteElm.innerText = 'Unmute';
    console.info('Call is muted');
  } else {
    muteElm.innerText = 'Mute';
    console.info('Call is unmuted');
  }
  currentTask.toggleMute();
}

function togglePauseResumeRecording() {
  // Button states will be updated by task.uiControls after operation completes
  const autoResumed = autoResumeCheckboxElm.checked;
  const isPausing = pauseResumeRecordingElm.innerText === 'Pause Recording';
  
  const operation = isPausing 
    ? currentTask.pauseRecording()
    : currentTask.resumeRecording(autoResumed ? { autoResumed } : undefined);
    
  operation.then(() => {
    console.info(isPausing ? 'Recording paused successfully' : 'Recording resumed successfully');
    updateTaskList();
  }).catch((error) => {
    console.error(isPausing ? 'Failed to pause recording' : 'Failed to resume recording', error);
    updateTaskList();
  });
}

function endCall() {
  // Button states will be updated by task.uiControls after operation completes
  currentTask.end().then(() => {
    console.log('task ended successfully by agent');
    updateTaskList();
    updateUnregisterButtonState();
  }).catch((error) => {
    console.error('Failed to end the call', error);
    updateTaskList();
  });
}

function wrapupCall() {
  // Button states will be updated by task.uiControls after operation completes
  const wrapupReason = wrapupCodesDropdownElm.options[wrapupCodesDropdownElm.selectedIndex].text;
  const auxCodeId = wrapupCodesDropdownElm.options[wrapupCodesDropdownElm.selectedIndex].value;
  currentTask.wrapup({wrapUpReason: wrapupReason, auxCodeId: auxCodeId}).then(() => {
    console.info('Call wrapped up successfully');
    updateTaskList();
  }).catch((error) => {
    console.error('Failed to wrap up the call', error);
    updateTaskList();
  });
}

const handleBundleLoaded = () => {
  console.log("bundle.js has been loaded.");
  isBundleLoaded = true;
};

const initializeEngageWidget = () => {
  if (isBundleLoaded) {
    const config = {
      logger: console,
      cb: (name, data) => {
        const event = new CustomEvent(name, {
          detail: data,
        });
        window.dispatchEvent(event);
      },
    };
    const imiEngageWC = new window.ImiEngageWC(config);
    imiEngageWC.setParam("data", {
      jwt: tokenElm.value,
      lang: "en-US",
      source: "wxcc",
    });
  } else {
    console.error("Bundle not loaded yet.");
  }
}

document.addEventListener(
  "imi-engage-bundle-load-success",
  handleBundleLoaded
);

function updateTaskList() {
  const taskList = webex.cc.taskManager.getAllTasks(); // Update the global task list
  renderTaskList(taskList); // Render the updated task list
}

function renderTaskList(taskList) {
  const taskListContainer = document.getElementById('taskList');
  taskListContainer.innerHTML = ''; // Clear existing tasks

  if (!taskList || Object.keys(taskList).length === 0) {
    // No tasks - apply default (all disabled) controls
    applyAllControlsFromUIControls(null);
    renderTaskControlsSections(null);
    incomingDetailsElm.innerText = 'No Incoming Tasks';
    autoWrapupTimerElm.style.display = 'none';
    taskListContainer.innerHTML = '<p>No tasks available</p>';
    engageElm.innerHTML = ``;
    currentTask = undefined;
    participantListElm.style.display = 'none';
    return;
  }

  // Filter out orphaned tasks (customer disconnected during ALERTING)
  // Since SDK doesn't provide createdTime, we track it ourselves
  const ALERTING_STALE_THRESHOLD_MS = 25000; // 25 seconds (RONA timeout is ~18s)
  const activeTasks = Object.entries(taskList).filter(([taskId, task]) => {
    // Track when we first see this task
    if (!taskCreationTimes.has(taskId)) {
      taskCreationTimes.set(taskId, Date.now());
    }

    const state = task.data?.interaction?.state;
    const participants = task.data?.interaction?.participants;
    const agentJoined = agentId && participants?.[agentId]?.hasJoined;
    const mediaType = task.data?.interaction?.mediaType;

    // Check for explicit terminal states (if backend sets these)
    if (state === 'ended' || state === 'disconnected' || state === 'terminated') {
      console.warn(`⚠️ Customer disconnect detected - filtering orphaned task ${taskId} (state: ${state})`);
      taskCreationTimes.delete(taskId); // Clean up tracking
      return false;
    }

    // Check for stale ALERTING tasks (customer hung up before agent answered)
    // ONLY filter telephony tasks - digital channels (chat/email/social) can wait in queue longer
    if (state === 'new' && !agentJoined && mediaType === 'telephony') {
      const taskCreatedAt = taskCreationTimes.get(taskId);
      const taskAgeMs = Date.now() - taskCreatedAt;

      if (taskAgeMs > ALERTING_STALE_THRESHOLD_MS) {
        console.warn(
          `⚠️ Customer disconnect in ALERTING detected - filtering stale telephony task ${taskId} ` +
          `(age: ${Math.round(taskAgeMs/1000)}s, threshold: ${ALERTING_STALE_THRESHOLD_MS/1000}s)`
        );
        taskCreationTimes.delete(taskId); // Clean up tracking
        return false;
      }
    }

    return true;
  });

  // Clean up tracking for tasks that are no longer in the list
  const currentTaskIds = new Set(Object.keys(taskList));
  for (const [trackedTaskId] of taskCreationTimes) {
    if (!currentTaskIds.has(trackedTaskId)) {
      taskCreationTimes.delete(trackedTaskId);
    }
  }

  // If all tasks were filtered out, show "No tasks available"
  if (activeTasks.length === 0) {
    applyAllControlsFromUIControls(null);
    renderTaskControlsSections(null);
    incomingDetailsElm.innerText = 'No Incoming Tasks';
    autoWrapupTimerElm.style.display = 'none';
    taskListContainer.innerHTML = '<p>No tasks available</p>';
    engageElm.innerHTML = ``;
    currentTask = undefined;
    participantListElm.style.display = 'none';
    return;
  }

  // Keep track of last task for potential default selection
  let lastTask = null;
  let lastTaskId = null;
  let hasSelectedTask = false;
  
  // Check if the current task still exists in the active task list
  if (currentTask) {
    const currentTaskStillActive = activeTasks.find(([id]) => id === currentTask.data.interactionId);
    if (!currentTaskStillActive) {
      // Current task was removed or filtered out - clear UI controls immediately
      console.info('📋 Current task removed from list - clearing UI controls');
      applyAllControlsFromUIControls(null);
      renderTaskControlsSections(null);
      participantListElm.style.display = 'none';
      incomingDetailsElm.innerText = 'No Incoming Tasks';
      currentTask = undefined;
    }
  }

  for (const [taskId, task] of activeTasks) {
    const taskElement = document.createElement('div');
    taskElement.className = 'task-item';
    taskElement.setAttribute('data-task-id', taskId);

    // Add 'selected' class if this is the current task
    if (currentTask && taskId === currentTask.data.interactionId) {
      taskElement.classList.add('selected');
      currentTask = task;
      hasSelectedTask = true;
    }

    lastTask = task;
    lastTaskId = taskId;

    const callerDisplay = task.data.interaction.callAssociatedDetails?.ani;
    // Determine task properties
    const isNew = isIncomingTask(task, agentId); 
    const isTelephony = task.data.interaction.mediaType === 'telephony';
    const isBrowserPhone = agentDeviceType === 'BROWSER';
    const isAutoAnswering = task.data.isAutoAnswering || false;

    // Determine which buttons to show
    const showAcceptButton = isNew && (isBrowserPhone || !isTelephony);
    const showDeclineButton = isNew && isTelephony && isBrowserPhone;

    // Build the task element
    taskElement.innerHTML = `
        <div class="task-item-content">
            <p>${callerDisplay}</p>
            ${showAcceptButton ? `<button class="accept-task" data-task-id="${taskId}" ${isAutoAnswering ? 'disabled' : ''}>Accept</button>` : ''}
            ${showDeclineButton ? `<button class="decline-task" data-task-id="${taskId}" ${isAutoAnswering ? 'disabled' : ''}>Decline</button>` : ''}
        </div>
        <hr class="task-separator">
    `;

    // Add click event listener for the task item
    taskElement.addEventListener('click', () => {
      // Remove 'selected' class from all tasks
      document.querySelectorAll('.task-item').forEach(item => {
        item.classList.remove('selected');
      });

      // Add 'selected' class to the clicked task
      taskElement.classList.add('selected');

      handleTaskSelect(task); // Call the function when the task is clicked
    });

    taskListContainer.appendChild(taskElement);
  }

  // If no task is selected and we have at least one task, select the last one by default
  if (!hasSelectedTask && lastTask) {
    // Add selected class to the last task element
    const lastTaskElement = document.querySelector(`.task-item[data-task-id="${lastTaskId}"]`);
    if (lastTaskElement) {
      lastTaskElement.classList.add('selected');
      console.log('Selecting last task as default:', lastTaskId);
      currentTask = lastTask; // Update the current task
      handleTaskSelect(lastTask);
    }
  } else if (hasSelectedTask && currentTask) {
    // We have a selected task, ensure UI is updated correctly
    handleTaskSelect(currentTask);
  }

  // Add event listeners for accept and decline buttons
  // Rest of the function remains unchanged
  document.querySelectorAll('.accept-task').forEach((button) => {
    button.addEventListener('click', async (event) => {
      handleTaskSelect(currentTask);
      const taskId = event.target.getAttribute('data-task-id');
      const task = taskList[taskId];
      if (task) {
        currentTask = task;
        await answer();
      }  else {
        console.error(`Task not found for ID: ${taskId}`);
        alert('Cannot accept task: The task may have been removed or is no longer available.');
      }
    });
  });

  document.querySelectorAll('.decline-task').forEach((button) => {
    button.addEventListener('click', (event) => {
      const taskId = event.target.getAttribute('data-task-id');
      const task = taskList[taskId];
      if (task) {
        currentTask = task;
        decline();
      } else {
        console.error(`Task not found for ID: ${taskId}`);
        alert('Cannot decline task: The task may have been removed or is no longer available.');
      }
    });
  });
}

// REFACTORED: Button states now come from task.uiControls
// This function only updates display text, NOT button visibility/enabled state
function updateIncomingTaskDisplay(task) {
  if (!task || !incomingDetailsElm) return;
  
  const callerDisplay = task.data.interaction?.callAssociatedDetails?.ani || 'Unknown';
  const mediaType = task.data.interaction?.mediaType;
  const chatAndSocial = ['chat', 'social'];
  const isNew = isIncomingTask(task, agentId);
  const isAutoAnswering = task.data.isAutoAnswering || false;
  
  if (mediaType === 'telephony') {
    if (agentDeviceType === 'BROWSER') {
      incomingDetailsElm.innerText = `Call from ${callerDisplay}`;
      
      // Log auto-answer status for debugging
      if (isAutoAnswering) {
        console.log('✅ Auto-answer in progress for task:', task.data.interactionId);
      }
    } else {
      incomingDetailsElm.innerText = `Call from ${callerDisplay}...please answer on the endpoint where the agent's extension is registered`;
    }
  } else if (chatAndSocial.includes(mediaType)) {
    answerElm.disabled = !isNew || isAutoAnswering;
    declineElm.disabled = true;
    incomingDetailsElm.innerText = `Chat from ${callerDisplay}`;
    
    if (isAutoAnswering) {
      console.log('✅ Auto-answer in progress for task:', task.data.interactionId);
    }
  } else if (mediaType === 'email') {
    answerElm.disabled = !isNew || isAutoAnswering;
    declineElm.disabled = true;
    incomingDetailsElm.innerText = `Email from ${callerDisplay}`;
    
    if (isAutoAnswering) {
      console.log('✅ Auto-answer in progress for task:', task.data.interactionId);
    }
  }
  
  // Log auto-answer if in progress
  if (task.data.isAutoAnswering) {
    console.log('✅ Auto-answer in progress for task:', task.data.interactionId);
  }
}

function handleTaskSelect(task) {
  // Handle the task click event
  console.log('Task clicked:', task);
  // Update incoming task display text and apply all button states from uiControls
  updateIncomingTaskDisplay(task);
  updateCallControlUI(task);
  engageElm.innerHTML = ``;
  engageElm.style.height = "100px"
  const chatAndSocial = ['chat', 'social'];
  currentTask = task
  if (aiAssistantContentElm) aiAssistantContentElm.innerHTML = '';
  resetAssistantRawOutput();
 if (chatAndSocial.includes(task.data.interaction.mediaType) && isBundleLoaded && !task.data.wrapUpRequired) {
    loadChatWidget(task);
  } else if (task.data.interaction.mediaType === 'email' && isBundleLoaded && !task.data.wrapUpRequired) {
    loadEmailWidget(task);
  }
  updateCallControlUI(task); // Enable/disable transfer controls
}

function loadChatWidget(task) {
  const mediaId = task.data.interaction.callAssociatedDetails.mediaResourceId;
  engageElm.style.height = '500px';
  engageElm.innerHTML = `
    <imi-engage 
      theme="LIGHT" 
      lang="en-US" 
      conversationid="${mediaId}"
    ></imi-engage>
  `;
}

function loadEmailWidget(task) {
  engageElm.style.height = '900px';
  const mediaId = task.data.interaction.callAssociatedDetails.mediaResourceId;
  engageElm.innerHTML = `
    <imi-email-composer
      taskId="${mediaId}"
      orgId="${task.data.orgId}"
      agentName="${agentName}"
      agentId="${agentId}"
      interactionId="${task.data.interactionId}"
    ></imi-email-composer>
  `;
}

function populateLoginOptions(options) {
  agentLogin.innerHTML = '<option value="" selected>Choose Agent Login …</option>';
  updateLoginOptionElm.innerHTML = '<option value="" selected>Choose Login Option …</option>';
  options.forEach((opt) => {
    const opt1 = document.createElement('option');
    opt1.value = opt1.text = opt;
    agentLogin.add(opt1);
    updateLoginOptionElm.add(opt1.cloneNode(true));
  });
}

idleCodesDropdown.addEventListener('change', handleAgentStatus);

updateLoginOptionElm.addEventListener('change', (e) => {
  updateDialNumberElm.disabled = e.target.value === 'BROWSER';
});

function updateApplyButtonState() {
  const team = updateTeamDropdownElm.value;
  const loginOption = updateLoginOptionElm.value;
  const dialRequired = loginOption !== 'BROWSER';
  const dialValid = !dialRequired || updateDialNumberElm.value.trim() !== '';
  applyupdateAgentProfileBtn.disabled = !(team && loginOption && dialValid);
}

updateTeamDropdownElm.addEventListener('change', updateApplyButtonState);
updateLoginOptionElm.addEventListener('change', updateApplyButtonState);
updateDialNumberElm.addEventListener('input', updateApplyButtonState);

updateApplyButtonState();

// ==================== User Preferences API ====================

const userPrefResultElm = document.getElementById('userPrefResult');
const getUserPrefBtn = document.getElementById('getUserPrefBtn');
const createUserPrefBtn = document.getElementById('createUserPrefBtn');
const updateUserPrefBtn = document.getElementById('updateUserPrefBtn');
const deleteUserPrefBtn = document.getElementById('deleteUserPrefBtn');
const userPrefCreateDialog = document.getElementById('userPrefCreateDialog');
const userPrefUpdateDialog = document.getElementById('userPrefUpdateDialog');

function enableUserPreferenceButtons(enabled) {
  getUserPrefBtn.disabled = !enabled;
  createUserPrefBtn.disabled = !enabled;
  updateUserPrefBtn.disabled = !enabled;
  deleteUserPrefBtn.disabled = !enabled;
}

function showUserPrefResult(result, isError = false) {
  userPrefResultElm.textContent = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  userPrefResultElm.style.color = isError ? 'red' : 'inherit';
}

async function getUserPreference() {
  const userId = document.getElementById('userPrefUserId').value.trim();
  const pageInput = document.getElementById('userPrefPage').value;
  const pageSizeInput = document.getElementById('userPrefPageSize').value;
  
  const params = {};
  if (userId) params.userId = userId;
  if (pageInput !== '') params.page = parseInt(pageInput, 10);
  if (pageSizeInput !== '') params.pageSize = parseInt(pageSizeInput, 10);
  
  try {
    showUserPrefResult('Fetching user preferences...');
    const result = await webex.cc.userPreference.getUserPreference(Object.keys(params).length > 0 ? params : undefined);
    showUserPrefResult(result);
    console.log('User Preferences:', result);
  } catch (error) {
    showUserPrefResult(`Error: ${error.message}`, true);
    console.error('getUserPreference error:', error);
  }
}

function showCreatePreferenceDialog() {
  userPrefCreateDialog.classList.remove('hidden');
  userPrefUpdateDialog.classList.add('hidden');
  // Pre-fill with current agent ID if available
  if (agentId) {
    document.getElementById('createPrefUserId').value = agentId;
  }
}

function hideCreatePreferenceDialog() {
  userPrefCreateDialog.classList.add('hidden');
}

async function createUserPreference() {
  const userId = document.getElementById('createPrefUserId').value.trim();
  const desktopPreferenceJson = document.getElementById('createPrefDesktopPref').value.trim();
  
  if (!userId) {
    showUserPrefResult('Error: User ID is required for creating preferences', true);
    return;
  }
  
  if (!desktopPreferenceJson) {
    showUserPrefResult('Error: Desktop Preference JSON is required for creating preferences', true);
    return;
  }
  
  try {
    // Validate desktopPreference is valid JSON
    JSON.parse(desktopPreferenceJson);
    
    showUserPrefResult('Creating user preferences...');
    const result = await webex.cc.userPreference.createUserPreference({
      userId,
      desktopPreference: desktopPreferenceJson
    });
    showUserPrefResult(result);
    hideCreatePreferenceDialog();
    console.log('Created User Preferences:', result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      showUserPrefResult('Error: Invalid JSON format in Desktop Preference field.', true);
    } else {
      showUserPrefResult(`Error: ${error.message}`, true);
    }
    console.error('createUserPreference error:', error);
  }
}

function showUpdatePreferenceDialog() {
  userPrefUpdateDialog.classList.remove('hidden');
  userPrefCreateDialog.classList.add('hidden');
  // Pre-fill with current agent ID if available
  if (agentId) {
    document.getElementById('updatePrefUserId').value = agentId;
  }
}

function hideUpdatePreferenceDialog() {
  userPrefUpdateDialog.classList.add('hidden');
}

async function updateUserPreference() {
  const userId = document.getElementById('updatePrefUserId').value.trim();
  const desktopPreferenceJson = document.getElementById('updatePrefDesktopPref').value.trim();
  
  if (!userId) {
    showUserPrefResult('Error: User ID is required for updating preferences', true);
    return;
  }
  
  if (!desktopPreferenceJson) {
    showUserPrefResult('Error: Desktop Preference JSON is required for updating preferences', true);
    return;
  }
  
  try {
    // Validate desktopPreference is valid JSON
    JSON.parse(desktopPreferenceJson);
    
    showUserPrefResult('Updating user preferences...');
    const result = await webex.cc.userPreference.updateUserPreference(userId, {
      desktopPreference: desktopPreferenceJson
    });
    showUserPrefResult(result);
    hideUpdatePreferenceDialog();
    console.log('Updated User Preferences:', result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      showUserPrefResult('Error: Invalid JSON format in Desktop Preference field.', true);
    } else {
      showUserPrefResult(`Error: ${error.message}`, true);
    }
    console.error('updateUserPreference error:', error);
  }
}

async function deleteUserPreference() {
  const userId = document.getElementById('userPrefUserId').value.trim();
  
  if (!userId) {
    showUserPrefResult('Error: User ID is required for deleting preferences. Enter it in the User ID field above.', true);
    return;
  }
  
  if (!confirm(`Are you sure you want to delete preferences for user: ${userId}?`)) {
    return;
  }
  
  try {
    showUserPrefResult('Deleting user preferences...');
    await webex.cc.userPreference.deleteUserPreference(userId);
    showUserPrefResult('User preferences deleted successfully');
    console.log('Deleted User Preferences for:', userId);
  } catch (error) {
    showUserPrefResult(`Error: ${error.message}`, true);
    console.error('deleteUserPreference error:', error);
  }
}
