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
const ivrTranscriptContentElm = document.querySelector('#ivr-transcript-content');
const ivrTranscriptTabButton = document.querySelector('#ivr-transcript-tab');
const liveTranscriptTabButton = document.querySelector('#live-transcript-tab');
const ivrTranscriptPanel = document.querySelector('#ivr-transcript-panel');
const liveTranscriptPanel = document.querySelector('#live-transcript-panel');
deregisterBtn.style.backgroundColor = 'red';
let enableProd = true;

function changeEnv() {
  enableProd = !enableProd;
  changeEnvBtn.innerHTML = enableProd ? 'In Production' : 'In Integration';
}

const liveTranscriptEntries = [];
const MAX_TRANSCRIPT_LINES = 200;
let activeTranscriptConversationId = null;

function setTranscriptTab(tabName) {
  const isIvrTab = tabName === 'ivr';
  ivrTranscriptTabButton?.classList.toggle('active', isIvrTab);
  liveTranscriptTabButton?.classList.toggle('active', !isIvrTab);
  ivrTranscriptTabButton?.setAttribute('aria-selected', String(isIvrTab));
  liveTranscriptTabButton?.setAttribute('aria-selected', String(!isIvrTab));
  ivrTranscriptPanel?.classList.toggle('active', isIvrTab);
  ivrTranscriptPanel?.classList.toggle('hidden', !isIvrTab);
  liveTranscriptPanel?.classList.toggle('active', !isIvrTab);
  liveTranscriptPanel?.classList.toggle('hidden', isIvrTab);
}

function formatTranscriptTimestamp(value) {
  if (value === undefined || value === null || value === '') {
    return '00:00';
  }

  let timestamp = Number(value);
  if (Number.isNaN(timestamp)) {
    timestamp = Date.parse(value);
  }

  if (Number.isNaN(timestamp)) {
    return '00:00';
  }

  if (timestamp < 1_000_000_000_000) {
    timestamp *= 1000;
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeTranscriptPayload(payload) {
  const source = payload?.data?.data || payload?.data || payload || {};

  const textCandidate = source.content || source.transcript || source.text || source.message || source.action || '';
  const transcriptText = Array.isArray(textCandidate)
    ? textCandidate.join(' ')
    : String(textCandidate || '').trim();
  if (!transcriptText) {
    return null;
  }

  const rawSpeaker = source.speaker || source.speakerType || source.participantType || source.role || source.source || '';
  const speakerLower = String(rawSpeaker).toLowerCase();
  const isSystem = speakerLower.includes('tombstone') || speakerLower.includes('system') || speakerLower.includes('event');
  const isCustomer = speakerLower.includes('customer');

  const speaker = isSystem ? 'Tombstone' : isCustomer ? 'Customer' : 'You';
  const timestamp = source.timestamp || source.createdTime || source.time || source.receivedAt;

  return {
    type: isSystem ? 'system' : 'speech',
    speaker,
    text: transcriptText,
    timeLabel: formatTranscriptTimestamp(timestamp),
    conversationId: source.conversationId || source.interactionId || null,
  };
}

function renderLiveTranscripts() {
  if (!realtimeTranscriptsElm) {
    return;
  }

  realtimeTranscriptsElm.innerHTML = '';
  if (liveTranscriptEntries.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'realtime-transcript-empty';
    emptyState.textContent = 'No live transcript available.';
    realtimeTranscriptsElm.appendChild(emptyState);
    return;
  }

  liveTranscriptEntries.forEach((entry) => {
    if (entry.type === 'system') {
      const systemLine = document.createElement('div');
      systemLine.className = 'realtime-transcript-system';
      systemLine.textContent = `%${entry.speaker} - ${entry.text}%. ${entry.timeLabel}`;
      realtimeTranscriptsElm.appendChild(systemLine);
      return;
    }

    const row = document.createElement('div');
    row.className = 'realtime-transcript-event';

    const avatar = document.createElement('div');
    avatar.className = `realtime-transcript-avatar ${entry.speaker === 'You' ? 'you' : ''}`.trim();
    avatar.textContent = entry.speaker === 'Customer' ? 'CU' : 'YO';

    const content = document.createElement('div');
    const meta = document.createElement('div');
    meta.className = 'realtime-transcript-meta';

    const speaker = document.createElement('span');
    speaker.className = 'realtime-transcript-speaker';
    speaker.textContent = `%${entry.speaker}%`;

    const time = document.createElement('button');
    time.className = 'realtime-transcript-time';
    time.type = 'button';
    time.textContent = entry.timeLabel;

    const text = document.createElement('p');
    text.className = 'realtime-transcript-text';
    text.textContent = entry.text;

    meta.appendChild(speaker);
    meta.appendChild(time);
    content.appendChild(meta);
    content.appendChild(text);
    row.appendChild(avatar);
    row.appendChild(content);
    realtimeTranscriptsElm.appendChild(row);
  });

  realtimeTranscriptsElm.scrollTop = realtimeTranscriptsElm.scrollHeight;
}

function resetLiveTranscripts() {
  liveTranscriptEntries.length = 0;
  activeTranscriptConversationId = null;
  renderLiveTranscripts();
}

function appendRealtimeTranscript(payload) {
  const entry = normalizeTranscriptPayload(payload);
  if (!entry) {
    return;
  }

  if (entry.conversationId && activeTranscriptConversationId && activeTranscriptConversationId !== entry.conversationId) {
    resetLiveTranscripts();
  }

  if (entry.conversationId) {
    activeTranscriptConversationId = entry.conversationId;
  }

  liveTranscriptEntries.push(entry);
  if (liveTranscriptEntries.length > MAX_TRANSCRIPT_LINES) {
    liveTranscriptEntries.shift();
  }

  renderLiveTranscripts();
}

function renderIvrTranscript(task) {
  if (!ivrTranscriptContentElm) {
    return;
  }

  const ivrText = task?.data?.interaction?.callProcessingDetails?.convIvrTranscript;
  if (typeof ivrText === 'string' && ivrText.trim()) {
    ivrTranscriptContentElm.textContent = ivrText;
  } else {
    ivrTranscriptContentElm.textContent = 'No IVR transcript available.';
  }
}

if (clearTranscriptsButton) {
  clearTranscriptsButton.addEventListener('click', () => {
    resetLiveTranscripts();
  });
}

ivrTranscriptTabButton?.addEventListener('click', () => setTranscriptTab('ivr'));
liveTranscriptTabButton?.addEventListener('click', () => setTranscriptTab('live'));
setTranscriptTab('live');
renderLiveTranscripts();

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
  disableAllCallControls();
  if(currentTask) {
    wrapupElm.disabled = false;
    wrapupCodesDropdownElm.disabled = false;
  } else {
    wrapupElm.disabled = true;
    wrapupCodesDropdownElm.disabled = true;
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
    const entryPoints = await webex.cc.getEntryPoints();
    return entryPoints.data || [];
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

      consultDestinationInput = document.createElement('input');
      consultDestinationInput.type = 'text';
      consultDestinationInput.id = 'consultDestination';
      consultDestinationInput.placeholder = 'Enter Entry Point ID';

      const dataListId = 'consult-entrypoint-datalist';
      let dataList = consultDestinationHolderElm.querySelector(`#${dataListId}`);
      if (!dataList) {
        dataList = document.createElement('datalist');
        dataList.id = dataListId;
        consultDestinationHolderElm.appendChild(dataList);
      }
      dataList.innerHTML = '';
      entryPoints.forEach((ep) => {
        const option = document.createElement('option');
        option.value = ep.id;
        option.label = ep.name;
        dataList.appendChild(option);
      });
      consultDestinationInput.setAttribute('list', dataListId);
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
      await currentTask.consultTransfer(consultTransferPayload);
      console.log('Consult transfer initiated successfully');
    }
  } catch (error) {
    console.error('Failed to initiate consult transfer', error);
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
 * @param {Object} task - The task object containing interaction details
 * @returns {number} Number of active agent participants
 */
function getActiveAgentCount(task) {
  if (!task?.data?.interaction) return 0;
  
  const mediaMainCall = task.data.interaction.media?.[task.data.interactionId];
  const participantsInMainCall = new Set(mediaMainCall?.participants || []);
  const participants = task.data.interaction.participants || {};

  let agentCount = 0;
  participantsInMainCall.forEach((participantId) => {
    const participant = participants[participantId];
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
function updateParticipantList(task) {
  if (!task || !task.data || !task.data.interaction) {
    participantListElm.style.display = 'none';
    return;
  }
  
  const { participants } = task.data.interaction;
  const mediaMainCall = task.data.interaction.media?.[task.data.interactionId];
  const participantsInMainCall = new Set(mediaMainCall?.participants || []);
  
    
  if (task.data.isConferenceInProgress) {
    let participantHtml = '<strong>📋 Active Participants:</strong><br/>';
    
    // Only show participants who are actually in the main call
    participantsInMainCall.forEach((participantId) => {
      const participant = participants[participantId];
      if (!participant) return;
      
      const role = participant.pType || 'Unknown';
      const name = participant.name || participantId.substring(0, 8);
      
      // Don't show participants who have left
      if (participant.hasLeft) return;
      
      const status = participant.hasJoined !== false ? '✅' : '⏳';
  
      
      participantHtml += `${status} ${role}: ${name}<br/>`;
    });
    
    participantListElm.innerHTML = participantHtml;
    participantListElm.style.display = 'block';
  } else {
    participantListElm.style.display = 'none';
  }
}

// Function to handle conference actions
async function toggleConference() {
  if (!currentTask) {
    alert('No active task');
    return;
  }

  try {
    console.log('Conference action:', {
      hasConsultationData: consultationData !== null,
      participants: Object.keys(currentTask.data?.interaction?.participants || {}),
      buttonText: conferenceToggleBtn.textContent
    });

    if (conferenceToggleBtn.textContent === 'Merge') {
      // Handle Ctrl+Click or Shift+Click for Exit Conference when in conference + consulting
      if (event && (event.ctrlKey || event.shiftKey)) {
        if (confirm('Exit the conference? (Ctrl/Shift+Click detected)')) {
          console.log('Exiting conference via Ctrl/Shift+Click...');
          await currentTask.exitConference();
          console.log('Conference exited successfully');
          return;
        }
      }
      await currentTask.consultConference();
      console.log('Conference merge operation completed successfully');
      
    } else if (conferenceToggleBtn.textContent === 'Exit Conference') {
      // Exit conference when no active consultation
      console.log('Exiting conference (no active consultation)...');
      await currentTask.exitConference();
      console.log('Conference exited successfully');
    }
    
    // The event listeners will handle UI updates with fresh task data
  } catch (error) {
    console.error(`Failed to perform conference action:`, error);
    alert(`Failed to perform conference action. ${error.message || 'Please try again.'}`);
  }
}

// Update conference button visibility and text
function updateConferenceButtonState(task, isConsultationInProgress) {
  // Use passed task parameter instead of global currentTask for consistency
  const taskToUse = task || currentTask;
  if (!conferenceToggleBtn || !taskToUse) return;
  // MPC Logic: Simplified conference button management
  if (!task.data.isConferenceInProgress || isConsultationInProgress) {
    // Show "Start Conference" button for ACTIVE consultation
    //conferenceToggleBtn.style.display = 'inline-block';
    conferenceToggleBtn.textContent = 'Merge';
    conferenceToggleBtn.className = 'btn--green';
    conferenceToggleBtn.title = 'Merge consultation into conference with all participants';
  } else  {
    // MPC: In conference - show EXIT CONFERENCE (not "End Conference")
    conferenceToggleBtn.textContent = 'Exit Conference';
    conferenceToggleBtn.className = 'btn--red';
    conferenceToggleBtn.title = 'Exit from conference (other agents continue, you enter wrap-up)';
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
    console.log('Selected ANI:', selectedAni || 'None selected');
    
    // Use selected ANI as the origin parameter
    if (selectedAni) {
      await webex.cc.startOutdial(destination, selectedAni);
      console.log('Outdial call initiated successfully with ANI:', selectedAni);
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


// Enable transfer button after task is accepted
function enableTransferControls() {
  transferElm.disabled = false;
}

// Disable transfer button after task is accepted
function disableTransferControls() {
  transferElm.disabled = true;
}

// Disable all buttons post consulting
function disableCallControlPostConsult() {
  holdResumeElm.disabled = true;
  pauseResumeRecordingElm.disabled = true;
  endElm.disabled = true;
}

// Enable all buttons post consulting
function enableCallControlPostConsult() {
  holdResumeElm.disabled = false;
  pauseResumeRecordingElm.disabled = false;
  endElm.disabled = false;
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

// Register task listeners
function registerTaskListeners(task) {
  task.on('REAL_TIME_TRANSCRIPTION', (payload) => {
    appendRealtimeTranscript(payload);
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

  task.on('task:hold', updateTaskList);

  task.on('task:resume', updateTaskList);

  // Consult flows
  task.on('task:consultCreated', updateTaskList);

  task.on('task:offerConsult', updateTaskList);

  task.on('task:consultAccepted', updateTaskList);

  task.on('task:consulting', updateTaskList);

  task.on('task:consultQueueCancelled', updateTaskList);

  task.on('task:consultEnd', updateTaskList);
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

  task.on('task:wrappedup', updateTaskList); // Update the task list UI to have latest tasks

  // Conference event listeners - Simplified approach
  task.on('task:participantJoined', (task) => {
    console.info('🚀 Conference started event - updating task list');
    updateTaskList(); // This will refresh currentTask and call updateCallControlUI with latest data
  });

  task.on('task:participantLeft', (task) => {
    console.info('🔚 Conference ended event - updating task list');
    updateTaskList(); // This will refresh currentTask and call updateCallControlUI with latest data
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
}

function disableAllCallControls() {
  holdResumeElm.disabled = true;
  muteElm.disabled = true;
  pauseResumeRecordingElm.disabled = true;
  consultTabBtn.disabled = true;
  transferElm.disabled = true;
  endElm.disabled = true;
  pauseResumeRecordingElm.disabled = true;
  conferenceToggleBtn.style.display = 'none';
  endConsultBtn.style.display = 'none';
  consultTransferBtn.style.display = 'none';
}

function makeDisabledAndHide(element, hide, disable)
{
  element.style.display = hide ? 'none' : 'inline-block';
  element.disabled = disable;
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
    return  taskState;
  }
}

function updateCallControlUI(task) {
  const { data } = task;
  const { interaction, mediaResourceId } = data;
  const { isTerminated, media, participants, callProcessingDetails } = interaction;

  autoWrapupTimerElm.style.display = 'none';
  if (task.data.wrapUpRequired) {
    participantListElm.style.display = 'none';
    updateButtonsPostEndCall();
    if (task.autoWrapup && task.autoWrapup.isRunning()) {
      startAutoWrapupTimer(task);
    }
    return;
  }

  wrapupElm.disabled = true;
  wrapupCodesDropdownElm.disabled = true;
  const hasParticipants = Object.keys(participants).length > 1;
  const isNew = isIncomingTask(task, agentId);
  const digitalChannels = ['chat', 'email', 'social'];
  const isBrowser = agentDeviceType === 'BROWSER';

  // Element lookup map to avoid eval usage
  const elementMap = {
    'holdResumeElm': holdResumeElm,
    'muteElm': muteElm,
    'pauseResumeRecordingElm': pauseResumeRecordingElm,
    'consultTabBtn': consultTabBtn,
    'declineElm': declineElm,
    'transferElm': transferElm,
    'endElm': endElm,
    'endConsultBtn': endConsultBtn,
    'consultTransferBtn': consultTransferBtn,
    'conferenceToggleBtn': conferenceToggleBtn
  };

  // Helper to set multiple controls at once
  function setControls(configs) {
    for (const [elmName, config] of Object.entries(configs)) {
      const element = elementMap[elmName];
      if (element) {
        makeDisabledAndHide(element, config.hide, config.disable);
      }
    }
  }

  if (isNew) {
    disableAllCallControls();
    enableAnswerDeclineButtons(currentTask);
    return;
  }

  if (digitalChannels.includes(task.data.interaction.mediaType)) {
    holdResumeElm.disabled = true;
    muteElm.disabled = true;
    pauseResumeRecordingElm.disabled = true;
    consultTabBtn.disabled = true;
    declineElm.disabled = true;
    transferElm.disabled = false;
    endElm.disabled = !hasParticipants;
    pauseResumeRecordingElm.disabled = true;
    return;
  }

  if (task?.data?.interaction?.mediaType === 'telephony') {
    // hold/resume call
    const isHold = isInteractionOnHold(task);
    holdResumeElm.disabled = isTerminated;
    holdResumeElm.innerText = isHold ? 'Resume' : 'Hold';

    // MPC: Hide transfer button in conference mode (Exit Conference replaces transfer)
    if (task.data.isConferenceInProgress) {
      transferElm.disabled = true;
      transferElm.style.display = 'none';
    } else {
      transferElm.disabled = false;
      transferElm.style.display = 'inline-block';
    }

    muteElm.disabled = false;
    endElm.disabled = !hasParticipants;

    pauseResumeRecordingElm.disabled = false;
    pauseResumeRecordingElm.innerText = 'Pause Recording';
    if (callProcessingDetails) {
      const { isPaused } = callProcessingDetails;
      pauseResumeRecordingElm.innerText = isPaused === 'true' ? 'Resume Recording' : 'Pause Recording';
    }

    const consultStatus = getConsultStatus(task, agentId);
    console.log(`event {task.data.type} ${consultStatus}`);
    
    // Check if we've reached the 7 participant limit
    const activeAgentCount = getActiveAgentCount(task);
    const hasReachedParticipantLimit = activeAgentCount >= 7;
    
    // Update consult button tooltip if disabled due to participant limit
    if (hasReachedParticipantLimit) {
      consultTabBtn.title = 'Maximum 7 participants allowed in conference';
    } else {
      consultTabBtn.title = 'Initiate consultation with another agent';
    }
    
    updateConferenceButtonState(task, consultStatus === 'beingConsultedAccepted' || consultStatus === 'consultAccepted');

    // Map consultStatus to control configs
    const controlMap = {
      beingConsulted: () => {}, // No changes
      beingConsultedAccepted: () => setControls({
        'holdResumeElm': { hide: true, disable: false },
        'muteElm': { hide: false || !isBrowser, disable: false },
        'pauseResumeRecordingElm': { hide: false, disable: true },
        'consultTabBtn': { hide: true, disable: true },
        'transferElm': { hide: true, disable: true },
        'endElm': { hide: true, disable: true },
        'endConsultBtn': { hide: false, disable: false },
        'consultTransferBtn': { hide: true, disable: true },
        'conferenceToggleBtn': { hide: true, disable: true },
      }),
      consultInitiated: () => setControls({
        'holdResumeElm': { hide: true, disable: false },
        'muteElm': { hide: true, disable: false },
        'pauseResumeRecordingElm': { hide: true, disable: false },
        'consultTabBtn': { hide: true, disable: hasReachedParticipantLimit },
        'transferElm': { hide: true, disable: false },
        'endElm': { hide: false, disable: true }, // Disable end call during consultation
        'endConsultBtn': { hide: false, disable: false },
        'consultTransferBtn': { hide: true, disable: true },
        'conferenceToggleBtn': { hide: true, disable: true },
      }),
      consultAccepted: () => setControls({
        'holdResumeElm': { hide: true, disable: false },
        'muteElm': { hide: false || !isBrowser, disable: false },
        'pauseResumeRecordingElm': { hide: false, disable: true },
        'consultTabBtn': { hide: true, disable: hasReachedParticipantLimit },
        'transferElm': { hide: true, disable: false },
        'endElm': { hide: true, disable: true }, // Disable end call during consultation
        'endConsultBtn': { hide: false, disable: false },
        'consultTransferBtn': { hide: false, disable: false },
        'conferenceToggleBtn': { hide: false, disable: false },
      }),
      conference: () => setControls({
        'consultTabBtn': { hide: false, disable: hasReachedParticipantLimit },
        'transferElm': { hide: true, disable: false },
        'endConsultBtn': { hide: true, disable: true },
        'muteElm': { hide: false || !isBrowser, disable: false },
        'pauseResumeRecordingElm': { hide: false, disable: false },
        'holdResumeElm': { hide: false, disable: !isHold },
        'endElm': { hide: false, disable: isHold || false }, // Allow end call in conference
        'consultTransferBtn': { hide: true, disable: true },
        'conferenceToggleBtn': { hide: false, disable: false },
      }),
      connected: () => setControls({
        'consultTabBtn': { hide: false, disable: hasReachedParticipantLimit },
        'transferElm': { hide: false, disable: false },
        'endConsultBtn': { hide: true, disable: true },
        'muteElm': { hide: false || !isBrowser, disable: false },
        'pauseResumeRecordingElm': { hide: false, disable: false },
        'holdResumeElm': { hide: false, disable: false },
        'endElm': { hide: false, disable: isHold || false },
        'consultTransferBtn': { hide: true, disable: true },
        'conferenceToggleBtn': { hide: true, disable: true },
      })
    };

    if (consultStatus && controlMap[consultStatus]) {
      controlMap[consultStatus]();
    }

    // MPC: Update participant list display
    updateParticipantList(task);
  }
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
  enableAnswerDeclineButtons(currentTask);
});

 async function answer() {
  answerElm.disabled = true;
  declineElm.disabled = true;
  await currentTask.accept();
  updateTaskList();
  incomingDetailsElm.innerText = 'Task Accepted';
}

function decline() {
  answerElm.disabled = true;
  declineElm.disabled = true;
  currentTask.decline(taskId);
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
  if (holdResumeElm.innerText === 'Hold') {
    holdResumeElm.disabled = true;
    currentTask.hold().then(() => {
      console.info('Call held successfully');
    }).catch((error) => {
      console.error('Failed to hold the call', error);
    });
  } else {
    holdResumeElm.disabled = true;
    currentTask.resume().then(() => {
      console.info('Call resumed successfully');
    }).catch((error) => {
      console.error('Failed to resume the call', error);
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
  currentTask.toggleMute();
}

function togglePauseResumeRecording() {
  const autoResumed = autoResumeCheckboxElm.checked;
  if (pauseResumeRecordingElm.innerText === 'Pause Recording') {
    pauseResumeRecordingElm.disabled = true;
    currentTask.pauseRecording().then(() => {
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
    const resumeParams = autoResumed ? { autoResumed: autoResumed } : undefined;
    currentTask.resumeRecording(resumeParams).then(() => {
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
  currentTask.end().then(() => {
    console.log('task ended successfully by agent');
    updateTaskList();
    updateUnregisterButtonState();
  }).catch((error) => {
    console.error('Failed to end the call', error);
    endElm.disabled = false;
  });
}

function wrapupCall() {
  wrapupElm.disabled = true;
  const wrapupReason = wrapupCodesDropdownElm.options[wrapupCodesDropdownElm.selectedIndex].text;
  const auxCodeId = wrapupCodesDropdownElm.options[wrapupCodesDropdownElm.selectedIndex].value;
  currentTask.wrapup({wrapUpReason: wrapupReason, auxCodeId: auxCodeId}).then(() => {
    console.info('Call wrapped up successfully');
    holdResumeElm.innerText = 'Hold';
    holdResumeElm.disabled = true;
    endElm.disabled = true;
    wrapupCodesDropdownElm.disabled = true;
    updateTaskList();
  }).catch((error) => {
    console.error('Failed to wrap up the call', error);
    wrapupElm.disabled = false;
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
    disableAnswerDeclineButtons();
    incomingDetailsElm.innerText = '';
    disableAllCallControls();
    wrapupElm.disabled = true;
    wrapupCodesDropdownElm.disabled = true;
    autoWrapupTimerElm.style.display = 'none';
    taskListContainer.innerHTML = '<p>No tasks available</p>';
    engageElm.innerHTML = ``;
    currentTask = undefined;
    participantListElm.style.display = 'none';
    renderIvrTranscript(undefined);
    resetLiveTranscripts();
    return;
  }
  
  // Keep track of last task for potential default selection
  let lastTask = null;
  let lastTaskId = null;
  let hasSelectedTask = false;
  
  // Check if the current task still exists in the task list
  if (currentTask) {
    const currentTaskStillExists = taskList[currentTask.data.interactionId];
    if (!currentTaskStillExists) {
      // Current task was removed, we'll need to select another one
      currentTask = undefined;
    }
  }
  
  for (const [taskId, task] of Object.entries(taskList)) {
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

function enableAnswerDeclineButtons(task) {
  const callerDisplay = task.data.interaction?.callAssociatedDetails?.ani;
  const isNew = isIncomingTask(task, agentId); 
  const isAutoAnswering = task.data.isAutoAnswering || false;
  const chatAndSocial = ['chat', 'social'];
  
  if (task.data.interaction.mediaType === 'telephony') {
    if (agentDeviceType === 'BROWSER') {
      // Disable buttons if auto-answering or not new
      answerElm.disabled = !isNew || isAutoAnswering;
      declineElm.disabled = !isNew || isAutoAnswering;
  
      incomingDetailsElm.innerText = `Call from ${callerDisplay}`;
      
      // Log auto-answer status for debugging
      if (isAutoAnswering) {
        console.log('✅ Auto-answer in progress for task:', task.data.interactionId);
      }
    } else {
      incomingDetailsElm.innerText = `Call from ${callerDisplay}...please answer on the endpoint where the agent's extension is registered`;
    }
  } else if (chatAndSocial.includes(task.data.interaction.mediaType)) {
    answerElm.disabled = !isNew || isAutoAnswering;
    declineElm.disabled = true;
    incomingDetailsElm.innerText = `Chat from ${callerDisplay}`;
    
    if (isAutoAnswering) {
      console.log('✅ Auto-answer in progress for task:', task.data.interactionId);
    }
  } else if (task.data.interaction.mediaType === 'email') {
    answerElm.disabled = !isNew || isAutoAnswering;
    declineElm.disabled = true;
    incomingDetailsElm.innerText = `Email from ${callerDisplay}`;
    
    if (isAutoAnswering) {
      console.log('✅ Auto-answer in progress for task:', task.data.interactionId);
    }
  }
}

function disableAnswerDeclineButtons() {
  answerElm.disabled = true;
  declineElm.disabled = true;
}

function handleTaskSelect(task) {
  // Handle the task click event
  console.log('Task clicked:', task);
  enableAnswerDeclineButtons(task);
  renderIvrTranscript(task);
  engageElm.innerHTML = ``;
  engageElm.style.height = "100px"
  const chatAndSocial = ['chat', 'social'];
  currentTask = task
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

