/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-underscore-dangle */
/* eslint-disable jsdoc/require-jsdoc */
/* eslint-env browser */
/* global Calling */

/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-global-assign */
/* eslint-disable no-multi-assign */
/* eslint-disable max-len */

// Globals
let calling;
let callingClient;
let correlationId;
let callHistory;
let voicemail;
let contacts;
let callSettings;
let line;

let transferInitiated;
const numberOfDays = 7;
const callHistoryLimit = 20;
const callHistorySort = 'ASC';
const callHistorySortBy = 'startTime';
const voicemailOffset = 0;
const voicemailOffsetLimit = 20;
const voicemailSort = 'DESC';
const credentialsFormElm = document.querySelector('#credentials');
const tokenElm = document.querySelector('#access-token');
const jwtTokenForDestElm = document.querySelector('#jwt-token-for-dest');
const guestContainerElm = document.querySelector('#guest-container');
const saveElm = document.querySelector('#access-token-save');
const authStatusElm = document.querySelector('#access-token-status');
const registerElm = document.querySelector('#registration-register');
const unregisterElm = document.querySelector('#registration-unregister');
const registrationStatusElm = document.querySelector('#registration-status');
const createCallingForm = document.querySelector('#calling-create');
const enableProduction = document.querySelector('#enableProduction');
const answerElm = document.querySelector('#answer');
const imageElm = document.querySelector('#img_home');
const outboundEndElm = document.querySelector('#end-call');
const endElm = document.querySelector('#end');
const endSecondElm = document.querySelector('#end-second');
const callDetailsElm = document.querySelector('#call-object');
const transferDetailsElm = document.querySelector('#transfer-call');
const transferOptionsElm = document.querySelector('#transfer-options');
const transferElm = document.querySelector('#transfer');
const userSessionData = document.querySelector('#user_session');
const localAudioElem = document.querySelector('#local-audio');
const localVideoElem = document.querySelector('#local-video');
const callListener = document.querySelector('#incomingsection');
const incomingDetailsElm = document.querySelector('#incoming-call');
const audioInputDevicesElem = document.querySelector('#sd-audio-input-devices');
// const videoInputDevicesElem = document.querySelector('#sd-video-input-devices');
const audioOutputDevicesElem = document.querySelector('#sd-audio-output-devices');
const toggleSourcesMediaDirection = document.querySelectorAll('[name=ts-media-direction]');
const dtmfDigit = document.getElementById('dtmf_digit');
const transferTarget = document.getElementById('transfer_target');
const holdResumeElm = document.getElementById('hold_button');
const callHistoryElm = document.querySelector('#Call-history');
const voicemailElm = document.querySelector('#Voice-mail');
const registrationForm = document.querySelector('#auth-registration');
const serviceIndicator = document.querySelector('#ServiceIndicator');
const serviceDomain = document.querySelector('#ServiceDomain');
const callQualityMetrics = document.querySelector('#call-quality-metrics');
const voiceMailContactElm = document.querySelector('#voicemail-form');
const resolvedContact = document.querySelector('#resolved-contact');
const vmContactAvatar = document.querySelector('#img_vm_contact');
const dndButton = document.querySelector('#DND-button');
const callWaitingButton = document.querySelector('#CallWaiting-button');
const transcriptContent = document.querySelector('#transcript-data');
const contactsElem = document.querySelector('#contacts-form');
const contactGroupsElem = document.querySelector('#contactgroups-form');
const contactsTable = document.getElementById('contactsTableId');
const contactsHeader = document.getElementById('contactsHeaderId');
const contactGroupsTable = document.getElementById('contactGroupsTableId');
const contactGroupsHeader = document.getElementById('contactGroupsHeaderId');
const cloudContactsElem = document.querySelector('#cloud-contact-form');
const contactObj = document.querySelector('#contact-object');
const contactGroupObj = document.querySelector('#contactgroup-object');
const summaryContent = document.querySelector('#summary-data');
const directoryNumberCFA = document.querySelector('#directoryNumber');
const cfaDataElem = document.querySelector('#callforwardalways-data');
const makeCallBtn = document.querySelector('#create-call-action');
const muteElm = document.getElementById('mute_button');
const bnrButton = document.getElementById('bnr-button');

let base64;
let audio64;
let call;
let callTransferObj;
let broadworksCorrelationInfo;
let localAudioStream;
let effect;

const devicesById = {};
const img = new Image();
const vmAvatarImg = new Image(100);

document.querySelectorAll('.collapsible').forEach((el) => {
  el.addEventListener('click', (event) => {
    const {parentElement} = event.currentTarget;

    const sectionContentElement = parentElement.querySelector('.section-content');

    sectionContentElement.classList.toggle('collapsed');
  });
});

const getOptionValue = (select) => {
  const selected = select.options[select.options.selectedIndex];

  return selected ? selected.value : undefined;
};

function getMediaSettings() {
  const settings = {};

  toggleSourcesMediaDirection.forEach((options) => {
    settings[options.value] = options.checked;
  });

  return settings;
}

function updateCallControlButtons(callObject){
    holdResumeElm.value = callObject.held ? 'Resume':'Hold'
    muteElm.value = callObject.muted ? 'Unmute':'Mute'
}

function getAudioVideoInput() {
  const deviceId = (id) => devicesById[id];
  const audioInput = getOptionValue(audioInputDevicesElem) || 'default';
  // const videoInput = getOptionValue(videoInputDevicesElem) || 'default';

  return {audio: deviceId(audioInput)};
  // return {audio: deviceId(audioInput), video: deviceId(videoInput)};
}

let enableProd = true;
// Disable screenshare on join in Safari patch
const isSafari = /Version\/[\d.]+.*Safari/.test(navigator.userAgent);
const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

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

// Guest access token via Service App - Logic deployed on the AWS Lambda
async function fetchGuestAccessTokenLambda() {
  const response = await fetch('https://pbw56237i55l2vkcpc5dhskhra0bplhr.lambda-url.us-east-2.on.aws');
  const token = await response.text();

  return token;
}

async function generateGuestToken() {
  try {
    const guestAccessToken = await fetchGuestAccessTokenLambda();
    console.log('Guest Access Token: ', guestAccessToken);

    tokenElm.value = guestAccessToken;
  } catch (error) {
    if (error.code === 401) {
      // TODO: Refresh the access token and try again with the new token
    }
  }    
}

async function handleServiceSelect(e) {
  const value = e.target.value;
  tokenElm.value = '';

  if (value === 'guestCalling') {
    guestContainerElm.classList.remove('hidden');
  } else {
    guestContainerElm.classList.add('hidden');
  }
}

async function initCalling(e) {
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

  const clientConfig = {
    calling: true,
    contact: true,
    callHistory: true,
    callSettings: true,
    voicemail: true,
  }

  const loggerConfig = {
    level: 'info'
  }

  const {region, country} = credentialsFormElm.elements;

  const serviceData = {indicator: 'calling', domain: ''};

  if (serviceIndicator.value) {
    serviceData.indicator = serviceIndicator.value;
  }

  if (serviceDomain.value) {
    serviceData.domain = serviceDomain.value;
  }

  const callingClientConfig = {
    logger: loggerConfig,
    discovery: {
      region: region.value,
      country: country.value,
    },
    serviceData,
    jwe: jwtTokenForDestElm.value,
  };

  if (callingClientConfig.discovery.country === 'Country') {
    callingClientConfig.discovery.country = '';
  }

  if (callingClientConfig.discovery.region === 'Region') {
    callingClientConfig.discovery.region = '';
  }

  const callingConfig = {
    clientConfig : clientConfig,
    callingClientConfig: callingClientConfig,
    logger:loggerConfig
  }

  calling = await Calling.init({webexConfig, callingConfig});

  calling.on('ready', () => {
    console.log('Authentication :: Calling Ready');
    callHistoryElm.disabled = false;
    voicemailElm.disabled = false;
    authStatusElm.innerText = 'Saved access token!';
    callHistoryElm.classList.add('btn--green');
    voicemailElm.classList.add('btn--green');
    dndButton.classList.add('btn--red');
    dndButton.innerHTML = 'Fetching DND Status';
    dndButton.disabled = true;
    callWaitingButton.classList.add('btn--red');
    callWaitingButton.innerHTML = 'Fetching Call Waiting Status';
    callWaitingButton.disabled = true;

    calling.register().then(async () => {
      unregisterElm.classList.add('btn--red');
      registerElm.classList.add('btn--green');
      registerElm.disabled = false;

      callingClient = window.callingClient = calling.callingClient;

      if (window.contacts === undefined) {
        contacts = window.contacts = calling.contactClient;
      }

      if (window.callHistory === undefined) {
        callHistory = window.callHistory = calling.callHistoryClient;
      }

      if (window.callSettings === undefined) {
        callSettings = window.callSettings = calling.callSettingsClient;
      }

      if (window.voicemail === undefined) {
        voicemail = window.voicemail = calling.voicemailClient;
      }

      fetchLines();
    });
  });

  return false;
}

credentialsFormElm.addEventListener('submit', initCalling);

function getSettings() {
  fetchCallForwardSetting();
  fetchVoicemailSetting();
  fetchCallWaitingSetting();
  fetchDNDSetting();
}

function toggleDisplay(elementId, status) {
  const element = document.getElementById(elementId);

  if (status) {
    element.classList.remove('hidden');
  } else {
    element.classList.add('hidden');
  }
}

const callNotifyEvent = new CustomEvent('line:incoming_call', {
  detail: {
    callObject: call,
  },
});

callListener.addEventListener('line:incoming_call', (myEvent) => {
  console.log('Received incoming call');
  answerElm.disabled = false;
  const callerDisplay = myEvent.detail.callObject.getCallerInfo();

  incomingDetailsElm.innerText = `Call from ${callerDisplay.name}, Ph: ${callerDisplay.num}`;
  makeCallBtn.disabled = true;
  console.log(`Call from :${callerDisplay.name}:${callerDisplay.num}`);
});

function userSession() {
  callingClient.on('callingClient:user_recent_sessions', (sessionData) => {
    console.log('Users recent session data : ', sessionData.data.userSessions.userSessions[0]);
    userSessionData.innerText = `${JSON.stringify(sessionData.data.userSessions.userSessions[0])}`;
  });
}

function createDevice() {
  line.register();
  userSession();
  line.on('registered', (deviceInfo) => {
    console.log("registered success");
    registerElm.disabled = true;
    registrationStatusElm.innerText =
      calling.webex.internal.device.url !== ''
        ? `Registered, deviceId: ${deviceInfo.mobiusDeviceId}`
        : 'Not Registered';
    unregisterElm.disabled = false;
  });

  // Start listening for incoming calls
  line.on('line:incoming_call', (callObj) => {
    call = callObj;
    call.on('caller_id', (CallerIdEmitter) => {
      callDetailsElm.innerText = `Name: ${CallerIdEmitter.callerId.name}, Number: ${CallerIdEmitter.callerId.num}, Avatar: ${CallerIdEmitter.callerId.avatarSrc}, UserId: ${CallerIdEmitter.callerId.id}`;
      console.log(
        `callerId : Name: ${CallerIdEmitter.callerId.name}, Number: ${CallerIdEmitter.callerId.name}, Avatar: ${CallerIdEmitter.callerId.avatarSrc}, UserId: ${CallerIdEmitter.callerId.id}`
      );
      if (CallerIdEmitter.callerId.avatarSrc) {
        img.src = CallerIdEmitter.callerId.avatarSrc;
        imageElm.appendChild(img);
      }
    });

    call.on('disconnect', () => {
      callDetailsElm.innerText = `${correlationId}: Call Disconnected`;
      makeCallBtn.disabled = false;
      endElm.disabled = true;
      muteElm.value = 'Mute';
      holdResumeElm.value = 'Hold';
      answerElm.disabled = true;
    });

    callNotifyEvent.detail.callObject = callObj;
    correlationId = callObj.getCorrelationId();
    console.log(`APP.JS::  Incoming Call with correlationId: ${correlationId}`);
    broadworksCorrelationInfo = callObj.getBroadworksCorrelationInfo();
    if (broadworksCorrelationInfo !== undefined) {
      console.log(
        `APP.JS::  Incoming Call with broadworksCorrelationInfo: ${broadworksCorrelationInfo}`
      );
    }
    callListener.dispatchEvent(callNotifyEvent);
    console.log('Waiting for User to answer the call...');
  });
}

function endCall() {
  call.end();
  callDetailsElm.innerText = `${call.getCorrelationId()}: Call Disconnected`;
  outboundEndElm.disabled = true;
  makeCallBtn.disabled = false;
  endElm.disabled = true;
  muteElm.value = 'Mute';
  holdResumeElm.value = 'Hold'
  imageElm.removeChild(img);
}

function endSecondCall() {
  callTransferObj.end();
  transferDetailsElm.innerText = `${callTransferObj.getCorrelationId()}: Call Disconnected`;
  callTransferObj = null
  endSecondElm.disabled = true;
  transferElm.innerHTML = 'Transfer';
  updateCallControlButtons(call)
  if (call.muted){
    localAudioStream.outputStream.getAudioTracks()[0].enabled = false
  }
  imageElm.removeChild(img);
}

function muteUnmute() {
  muteElm.value = muteElm.value === 'Mute' ? 'Unmute' : 'Mute';
  if (callTransferObj){
    callTransferObj.mute(localAudioStream)
  }
  else {
    call.mute(localAudioStream);
  }
}

function holdResume() {
  if (callTransferObj){
    callTransferObj.on('held', (correlationId) => {
      if (holdResumeElm.value === 'Hold') {
        callDetailsElm.innerText = 'Call is held';
        holdResumeElm.value = 'Resume';
      }
    });

    callTransferObj.on('resumed', (correlationId) => {
      if (holdResumeElm.value === 'Resume') {
        callDetailsElm.innerText = 'Call is Resumed';
        holdResumeElm.value = 'Hold';
      }
    });
    callTransferObj.doHoldResume()
  }
  else{
    call.on('held', (correlationId) => {
      if (holdResumeElm.value === 'Hold') {
        callDetailsElm.innerText = 'Call is held';
        holdResumeElm.value = 'Resume';
      }
    });

    call.on('resumed', (correlationId) => {
      if (holdResumeElm.value === 'Resume') {
        callDetailsElm.innerText = 'Call is Resumed';
        holdResumeElm.value = 'Hold';
      }
    });
    call.doHoldResume();
  }
}

async function deleteDevice() {
  await calling.deregister();
  registerElm.disabled = false;
  unregisterElm.disabled = true;
  registrationStatusElm.innerText = "Unregistered";
}

function populateSourceDevices(mediaDevice) {
  let select = null;
  const option = document.createElement('option');

  // eslint-disable-next-line default-case
  switch (mediaDevice.kind) {
    case 'audioinput':
      select = audioInputDevicesElem;
      break;
    case 'audiooutput':
      select = audioOutputDevicesElem;
      break;
    // case 'videoinput':
    //   select = videoInputDevicesElem;
    //   break;
  }

  devicesById[mediaDevice.ID] = mediaDevice;
  option.value = mediaDevice.ID;
  option.text = mediaDevice.label;
  select && select.appendChild(option);
}

async function changeInputStream() {
  const selectedDevice = audioInputDevicesElem.options[audioInputDevicesElem.selectedIndex].value;

  const constraints = {
    audio: true,
    deviceId: selectedDevice ? { exact: selectedDevice } : undefined
  };
  const newStream  = await Calling.createMicrophoneStream(constraints);

  call.updateMedia(newStream);
  localAudioStream = newStream;
}

async function changeOutputStream() {
  const selectedDevice = audioOutputDevicesElem.options[audioOutputDevicesElem.selectedIndex].value;
  mediaStreamsRemoteAudio.setSinkId(selectedDevice);
}

async function changeStream() {
  changeInputStream();
  changeOutputStream();
}

/**
 *
 */
function unregister() {
  console.log('Authentication#unregister()');
  registerElm.disabled = true;
  // unregisterElm.disabled = true;
  registrationStatusElm.innerText = 'Un registering...';

  deleteDevice();
}

// Meetings Management Section --------------------------------------------------
const createCallForm = document.querySelector('#call-create');

function createCall(e) {
  e.preventDefault();
  const {destination} = createCallForm.elements;

  console.log(destination.value);
  makeCallBtn.disabled = true;
  outboundEndElm.disabled = false
  call = line.makeCall({
    type: 'uri',
    address: destination.value,
  });

  call.on('caller_id', (CallerIdEmitter) => {
    callDetailsElm.innerText = `Name: ${CallerIdEmitter.callerId.name}, Number: ${CallerIdEmitter.callerId.num}, Avatar: ${CallerIdEmitter.callerId.avatarSrc} , UserId: ${CallerIdEmitter.callerId.id}`;
    console.log(
      `callerId : Name: ${CallerIdEmitter.callerId.name}, Number: ${CallerIdEmitter.callerId.num}, Avatar: ${CallerIdEmitter.callerId.avatarSrc}, UserId: ${CallerIdEmitter.callerId.id}`
    );
    if (CallerIdEmitter.callerId.avatarSrc) {
      img.src = CallerIdEmitter.callerId.avatarSrc;
      imageElm.appendChild(img);
    }
  });

  call.on('progress', (correlationId) => {
    callDetailsElm.innerText = `${correlationId}: Call Progress`;
  });
  call.on('connect', (correlationId) => {
    callDetailsElm.innerText = `${correlationId}: Call Connect`;
  });
  call.on('established', (correlationId) => {
    callDetailsElm.innerText = `${correlationId}: Call Established`;
    transferElm.disabled = false;
  });
  call.on('disconnect', (correlationId) => {
    callDetailsElm.innerText = `${correlationId}: Call Disconnected`;
    makeCallBtn.disabled = false;
    endElm.disabled = true;
    muteElm.value = 'Mute';
    outboundEndElm.disabled = true;

    if (transferInitiated) {
      transferDetailsElm.innerText = `Transferred Successfully`;
      transferInitiated = false;
      transferElm.innerHTML = 'Transfer';
    }
  });

  call.on('remote_media', (track) => {
    document.getElementById('remote-audio').srcObject = new MediaStream([track]);
  });

  call.dial(localAudioStream);
}

function sendDigit() {
  const digits = dtmfDigit.value;

  console.log(`Digit pressed :- ${digits}`);

  call.sendDigit(digits);
}

async function getCallQuality() {
  let callRtpStats;

  if (call) {
    try {
      callRtpStats = await call.getCallRtpStats();
    } catch (e) {
      console.error(e);
      callQualityMetrics.innerText = `Call is outdated or does not exist`;
    }
    callQualityMetrics.innerText = JSON.stringify(callRtpStats, undefined, 2);
  } else {
    callQualityMetrics.innerText = `Call does not exist`;
  }
}

function commitTransfer() {

  const digit = transferTarget.value;

  transferElm.disabled = true;

  if (transferOptionsElm.options[transferOptionsElm.selectedIndex].text === 'Consult Transfer') {
    call.doHoldResume();
    transferDetailsElm.innerText = `Placed call: ${call.getCorrelationId()} on hold and dialing Transfer target`;

    callTransferObj = line.makeCall({
      type: 'uri',
      address: digit,
    });
    updateCallControlButtons(callTransferObj)
    callTransferObj.on('remote_media', (track) => {
      document.getElementById('remote-audio').srcObject = new MediaStream([track]);

      transferDetailsElm.innerText = `Got remote audio`;
    });

    callTransferObj.on('established', (correlationId) => {
      transferDetailsElm.innerText = `${correlationId}: Transfer target connected`;
      endSecondElm.disabled = false;
      transferElm.innerHTML = 'Commit';
      transferElm.disabled = false;
    });

    callTransferObj.on('disconnect', (correlationId) => {
      endSecondElm.disabled = true;
      callTransferObj = null;
    });

    callTransferObj.dial(localAudioStream);

  } else {
    console.log(`Initiating blind transfer with ${digit}`);
    call.completeTransfer('BLIND', undefined, digit);
  }
}

function initiateTransfer() {
  const digit = transferTarget.value;

  transferInitiated = true;
  if (!call.isHeld()) {
      commitTransfer();
  } else {
    transferDetailsElm.innerText = `Transferring call..`;
    if (callTransferObj) {
      console.log(`Completing consult transfer with ${digit}`);
      call.completeTransfer('CONSULT', callTransferObj.getCallId(), undefined);
    }
  }
}

async function getMediaStreams() {
  localAudioStream  = await Calling.createMicrophoneStream({audio: true});

  localAudioElem.srcObject = localAudioStream.outputStream;
  makeCallBtn.disabled = false;
}

async function toggleNoiseReductionEffect() {
  const options =  {authToken: tokenElm.value, env: enableProd ? 'prod': 'int'} 
  effect = await localAudioStream.getEffectByKind('noise-reduction-effect');

  if (!effect) {
    effect = await Calling.createNoiseReductionEffect(options);

    await localAudioStream.addEffect(effect);
  }

  if (effect.isEnabled) {
    await effect.disable();
    bnrButton.innerText = 'Enable BNR';
  } else {
    await effect.enable();
    bnrButton.innerText = 'Disable BNR';
  }
}

// Listen for submit on create meeting
createCallForm.addEventListener('submit', createCall);

function addPlayIfPausedEvents(mediaElements) {
  mediaElements.forEach((elem) => {
    elem.addEventListener('canplaythrough', (event) => {
      console.log('playVideoIfPaused#canplaythrough :: Play started', elem);
      if (elem.paused) elem.play();
    });
  });
}

function clearMediaDeviceList() {
  audioInputDevicesElem.innerText = '';
  audioOutputDevicesElem.innerText = '';
  // videoInputDevicesElem.innerText = '';
}

async function getMediaDevices() {
  const cameras = await callingClient.mediaEngine.Media.getCameras();
  cameras.forEach((camera) => {
    populateSourceDevices(camera);
  });

  const microphones = await callingClient.mediaEngine.Media.getMicrophones();
  microphones.forEach((microphone) => {
    populateSourceDevices(microphone);
  });

  const speakers = await callingClient.mediaEngine.Media.getSpeakers();
  speakers.forEach((speaker) => {
    populateSourceDevices(speaker);
  });
}

const mediaStreamsLocalAudio = document.querySelector('#local-audio');
const mediaStreamsLocalVideo = document.querySelector('#local-video');
const mediaStreamsRemoteVideo = document.querySelector('#remote-video');
const mediaStreamsRemoteAudio = document.querySelector('#remote-audio');

const htmlMediaElements = [
  mediaStreamsLocalAudio,
  mediaStreamsLocalVideo,
  mediaStreamsRemoteVideo,
  mediaStreamsRemoteAudio,
];

function cleanUpMedia() {
  htmlMediaElements.forEach((elem) => {
    if (elem.srcObject) {
      elem.srcObject.getTracks().forEach((track) => track.stop());
      // eslint-disable-next-line no-param-reassign
      elem.srcObject = null;
    }
  });
}

function answer() {
  console.log(' Call Answered!');

  answerElm.disabled = true;

  if (call) {
    call.on('established', (correlationId) => {
      callDetailsElm.innerText = `${correlationId}: Call Established`;
      console.log(` Call is Established: ${correlationId}`);
      endElm.disabled = false;
    });
    call.on('disconnect', () => {
      console.log(` Call is Disconnected: ${correlationId}`);
    });

    call.on('remote_media', (track) => {
      document.getElementById('remote-audio').srcObject = new MediaStream([track]);
    });

    call.answer(localAudioStream);
  }
}

function renderContacts(contacts, groupIdDisplayNameMap) {
  contactsTable.innerHTML = contacts.reduce((acc, contact,i) => {
    const parentGroups = [];
    contact.groups.forEach(groupId => parentGroups.push(groupIdDisplayNameMap[groupId]));

    const phoneNumbers = contact.phoneNumbers?.reduce((acc, currValue)=> acc + `<p>${currValue.type}:${currValue.value}</p>`, '');
    return acc +
    `
      <tr>
        <td>${i + 1}</td>
        <td><img src=${contact.avatarURL} width="80"> </td>
        <td>${contact.displayName}</td>
        <td>${contact.contactType}</td>
        <td>${phoneNumbers}</td>
        <td>${contact.contactId}</td>
        <td>${parentGroups}</td>
        <td><button onclick="deleteContact('${contact.contactId}')" class="btn--red">Delete</button></td>
      </tr>
    `;
  },'');
}

function renderContactGroups(groups) {
  contactGroupsTable.innerHTML = groups.reduce((acc, group, i) => {
    return acc + `
      <tr>
        <td>${i + 1}</td>
        <td>${group.displayName}</td>
        <td>${group.groupType}</td>
        <td>${group.groupId}</td>
        <td>${group.members}</td>
        <td><button onclick="deleteContactGroup('${group.groupId}')" class="btn--red">Delete</button></td>
      </tr>
    `
  },'');
}

function createContactsTable(contactsResponse) {
  const {contacts, groups} = contactsResponse.data;
  const groupIdDisplayNameMap = {};
  groups.forEach(group => groupIdDisplayNameMap[group.groupId] = group.displayName);
  renderContacts(contacts, groupIdDisplayNameMap);
  renderContactGroups(groups);
}

function definedTable(callHistoryResponse) {
  const callHistoryTable = document.getElementById('callHistoryTableId');
  const callHistoryHeader = document.getElementById('callHistoryHeaderId');
  const callHistHeaderHtml = `<tr><th>Id</th>
  <th>Name</th>
  <th>Direction</th>
  <th>Deposition</th>
  <th>StartTime</th>
  <th>EndTime</th>
  <th>SessionType</th>
  <th>CallbackAddress</th>
  <th>RedirectionReason</th>
  <th>Forwarded by</th>
  </tr>`;

  callHistoryHeader.innerHTML += callHistHeaderHtml;

  for (let i = 0; i < callHistoryResponse.data.userSessions.length; i += 1) {
    const callHistoryRow = `<tr>
    <td>${i + 1}</td>
    <td>${callHistoryResponse.data.userSessions[i].other.name}</td>
    <td>${callHistoryResponse.data.userSessions[i].direction}</td>
    <td>${callHistoryResponse.data.userSessions[i].disposition}</td>
    <td>${callHistoryResponse.data.userSessions[i].startTime}</td>
    <td>${callHistoryResponse.data.userSessions[i].endTime}</td>
    <td>${callHistoryResponse.data.userSessions[i].sessionType}</td>
    <td>${callHistoryResponse.data.userSessions[i].other.callbackAddress}</td>
    <td>${callHistoryResponse.data.userSessions[i].callingSpecifics?.redirectionDetails?.reason === undefined ? 'NA' : callHistoryResponse.data.userSessions[i].callingSpecifics.redirectionDetails.reason}</td>
    <td>${callHistoryResponse.data.userSessions[i].callingSpecifics?.redirectionDetails?.name === undefined ? 'NA' : callHistoryResponse.data.userSessions[i].callingSpecifics.redirectionDetails.name}</td>
  </tr>`;

    callHistoryTable.innerHTML += callHistoryRow;
  }
}

/**
 * Function to fetch recent call history records.
 */

async function createCallHistory() {
  try {
    callHistory.on('callHistory:user_recent_sessions', (sessionData) => {
      console.log('Users recent session data : ', sessionData.data.userSessions.userSessions[0]);
      userSessionData.innerText = `${JSON.stringify(
        sessionData.data.userSessions.userSessions[0]
      )}`;
    });

    const callHistoryResponse = await callHistory.getCallHistoryData(
      numberOfDays,
      callHistoryLimit,
      callHistorySort,
      callHistorySortBy
    );

    callHistoryElm.disabled = false;
    definedTable(callHistoryResponse);
    console.log('Call History response data ', callHistoryResponse.data.userSessions);
    callHistoryElm.disabled = true;

    return callHistoryResponse;
  } catch (err) {
    console.log(`Call history error response ${err}`);

    return err;
  }
}

/**
 * Function to use Voice Mail API's.
 */
async function createVoiceMail() {
  await voicemail.init();
  const backendConnector = calling.webex.internal.device.callingBehavior;

  if (backendConnector === 'NATIVE_SIP_CALL_TO_UCM') {
    voicemailElm.disabled = true;

    try {
      const getVoicemailListResponse = await voicemail.getVoicemailList(
        voicemailOffset,
        voicemailOffsetLimit,
        voicemailSort,
        true
      );

      const voiceMailList = getVoicemailListResponse.data.voicemailList;

      console.log('Voice mail list response', getVoicemailListResponse.data.voicemailList);
      const vmLength = getVoicemailListResponse.data.voicemailList.length;

      const voicemailTable = document.getElementById('voicemailTable');

      voicemailTable.innerHTML = '';
      if (vmLength !== 0) {
        voicemailElm.disabled = false;
        const table = document.getElementById('voicemailTable');
        const thead = document.createElement('thead');
        const htr = document.createElement('tr');

        const th1 = document.createElement('th');

        th1.innerHTML = 'Caller Name';
        htr.appendChild(th1);

        const th2 = document.createElement('th');

        th2.innerHTML = 'Duration';
        htr.appendChild(th2);

        const th3 = document.createElement('th');

        th3.innerHTML = 'Date/Time';
        htr.appendChild(th3);

        const th5 = document.createElement('th');

        th5.innerHTML = 'Actions';
        htr.appendChild(th5);

        thead.appendChild(htr);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        for (let index = 0; index < vmLength; index += 1) {
          const vm = voiceMailList[index];
          const tr = document.createElement('tr');
          let td = document.createElement('td');

          td.innerHTML = vm.callingPartyInfo.name.$;
          tr.appendChild(td);
          tr.className = index;

          td = document.createElement('td');
          td.innerHTML = this.convertMStoS(vm.duration.$);
          tr.appendChild(td);

          td = document.createElement('td');
          td.innerHTML = this.convertUnix(vm.time.$);
          tr.appendChild(td);

          td = document.createElement('td');
          const msgId = getVoicemailListResponse.data.voicemailList[index].messageId.$;

          td.innerHTML = `<div>
          <div style="width: 10%; float:left"><input type = 'button' onclick = 'createVoiceMailContentPlay("${msgId}", ${tr.className})' value = 'Play'/></div>
          <div style="width: 20%; float:left; padding-left:40px" id='read${tr.className}'> <input type = 'button' onclick = 'voicemailMarkAsRead("${msgId}", ${tr.className})' value = 'MarkAsRead'/></div>
          <div style="float:left; padding-left:40px" id='unread${tr.className}'> <input type = 'button'  onclick = 'voicemailMarkAsUnRead("${msgId}", ${tr.className})' value = 'MarkAsUnRead'/></div>
          <div style="float:right; padding-right:40px" id='delete${tr.className}'> <input type = 'button'  onclick = 'deleteVoicemail("${msgId}", ${tr.className})' value = 'Delete'/></div>
          <div>
          <audio controls id="${msgId}">
          Your browser does not support the audio element.
          </audio>
          </div>
          </div>
          `;
          tr.appendChild(td);
          tbody.appendChild(tr);
          table.appendChild(tbody);
        }
        for (let index = 0; index < vmLength; index += 1) {
          const vm = voiceMailList[index];

          if (vm.read === 'true') {
            this.markAsRead(index);
          } else {
            this.markAsUnRead(index);
          }
        }
      } else {
        console.log('Voice mail is empty');
      }

      return getVoicemailListResponse;
    } catch (err) {
      console.log(`Voice Mail error response ${err}`);

      return err;
    }
  } else {
    voicemailElm.disabled = true;
    const logger = {level: 'info'};

    try {
      const getVoicemailListResponse = await voicemail.getVoicemailList(
        voicemailOffset,
        voicemailOffsetLimit,
        voicemailSort,
        true
      );

      voicemailElm.disabled = false;

      if (getVoicemailListResponse?.data.voicemailList.length) {
        const messageId = getVoicemailListResponse.data.voicemailList[0].messageId.$;

        const getVoicemailContentResponse = await voicemail.getVoicemailContent(messageId);

        const markVoicemailAsRead = await voicemail.voicemailMarkAsRead(messageId);

        const markVoicemailAsUnread = await voicemail.voicemailMarkAsUnread(messageId);

        // const transcript = await voicemail.getVMTranscript(messageId);

        // const deleteVoicemailMessages = await voicemail.deleteVoicemail(messageId);

        console.log('Voice mail list response', getVoicemailListResponse.data.voicemailList);
        console.log(
          'Voice mail content response',
          getVoicemailContentResponse.data.voicemailContent
        );
        console.log('Voice mail read message status code', markVoicemailAsRead.statusCode);
        console.log('Voice mail unread message status code', markVoicemailAsUnread.statusCode);
        // console.log('Voicemail transcript data', transcript);
      } else {
        console.log('Voice mail is empty');
      }

      return getVoicemailListResponse;
    } catch (err) {
      console.log(`Voice Mail error response ${err}`);

      return err;
    }
  }
}

function convertMStoS(ms) {
  const d = new Date(1000 * Math.round(ms / 1000)); // round to nearest second

  function pad(i) {
    return `0${i}`.slice(-2);
  }

  return `${d.getUTCHours()}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function convertUnix(unixTimeStamp) {
  const d = new Date(unixTimeStamp);

  return `${[d.getMonth() + 1, d.getDate(), d.getFullYear()].join('/')} ${[
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
  ].join(':')}`;
}

async function createVoiceMailContentPlay(msgId, rowId) {
  this.VMPlay(msgId, rowId);
}

async function VMPlay(msgId, rowId) {
  try {
    const getVoicemailContentResponse = await voicemail.getVoicemailContent(msgId);

    if (getVoicemailContentResponse.data?.voicemailContent) {
      console.log('Voice mail content response', getVoicemailContentResponse.data.voicemailContent);
      console.log(getVoicemailContentResponse.data?.voicemailContent);
      base64 = getVoicemailContentResponse.data?.voicemailContent?.content;
      audio64 = document.getElementById(msgId);
      audio64.src = `data:${getVoicemailContentResponse?.data?.voicemailContent?.type};base64,${getVoicemailContentResponse?.data?.voicemailContent?.content}`;
      audio64.play();

      const markVoicemailAsRead = await voicemail.voicemailMarkAsRead(msgId);

      if (markVoicemailAsRead.statusCode === 200 || markVoicemailAsRead.statusCode === 204) {
        this.markAsRead(rowId);
      }
    }

    return getVoicemailContentResponse;
  } catch (err) {
    console.log(`Voice Mail error response ${err}`);

    return err;
  }
}

async function voicemailMarkAsRead(msgId, rowId) {
  const markVoicemailAsRead = await voicemail.voicemailMarkAsRead(msgId);

  if (markVoicemailAsRead.statusCode === 200 || markVoicemailAsRead.statusCode === 204) {
    this.markAsRead(rowId);
  }
}

function markAsRead(rowId) {
  const voicemailTable = document.getElementById('voicemailTable');

  const rowSelected = voicemailTable.getElementsByTagName('tr')[rowId + 1];

  rowSelected.style.fontWeight = '';
  const markAsReadButton = document.getElementById(`read${rowId}`);

  markAsReadButton.style.display = 'none';
  const markAsUnReadButton = document.getElementById(`unread${rowId}`);

  markAsUnReadButton.style.display = 'block';
}

async function voicemailMarkAsUnRead(msgId, rowId) {
  const markVoicemailAsRead = await voicemail.voicemailMarkAsUnread(msgId);

  if (markVoicemailAsRead.statusCode === 200 || markVoicemailAsRead.statusCode === 204) {
    this.markAsUnRead(rowId);
  }
}

function markAsUnRead(rowId) {
  const voicemailTable = document.getElementById('voicemailTable');

  const rowSelected = voicemailTable.getElementsByTagName('tr')[rowId + 1];

  rowSelected.style.fontWeight = 'bold';
  const markAsUnReadButton = document.getElementById(`unread${rowId}`);

  markAsUnReadButton.style.display = 'none';
  const markAsReadButton = document.getElementById(`read${rowId}`);

  markAsReadButton.style.display = 'block';
}

async function deleteVoicemail(msgId, rowId) {
  const deleteVmResponse = await voicemail.deleteVoicemail(msgId);

  console.log(`deleteVmResponse status code : ${deleteVmResponse.statusCode}`);
  if (deleteVmResponse.statusCode === 200) {
    createVoiceMail();
  }
}

/**
 * Resolve Contact
 * @param name Name of sender
 * @param userExternalId User UUID of sender
 * @param address Phone number of sender
 * @returns {Promise<*>}
 */
async function resolveContact(name, userExternalId, address) {
  let callingPartyInfo = {};
  if (name) {
    callingPartyInfo.name = {$: name};
  }
  if (userExternalId) {
    callingPartyInfo.userExternalId = {$: userExternalId};
  }

  return voicemail.resolveContact(callingPartyInfo);
}

/**
 * Resolve Contact Info.
 *
 * @returns {Promise<null>}
 */
async function resolveContactInfo() {
  const {contactName, contactUserId} = voiceMailContactElm.elements;
  const contact = await resolveContact(contactName.value, contactUserId.value, undefined);

  console.log('Resolved Contact: ', contact);
  resolvedContact.innerText = JSON.stringify(contact, undefined, 2);
  if (contact && contact.avatarSrc) {
    vmAvatarImg.src = contact.avatarSrc;
    vmContactAvatar.appendChild(vmAvatarImg);
  }

  return null;
}

function fetchVoicemailList() {
  const offset = document.getElementById('offset').value;
  const offsetLength = document.getElementById('offsetLength').value;

  // eslint-disable-next-line prefer-template
  console.log('Fetching voicemails with offset and offsetLength ', offset, offsetLength);

  const response = voicemail.getVoicemailList(
    parseInt(offset, 10),
    parseInt(offsetLength, 10),
    voicemailSort
  );

  console.log(response);
}

/**
 * Fetch transcript.
 */
async function fetchTranscript() {
  const {messageId} = voiceMailContactElm.elements;
  const transcript = await voicemail.getVMTranscript(messageId.value);

  console.log('Voicemail transcript', transcript);
  transcriptContent.innerText = JSON.stringify(transcript.data.voicemailTranscript, undefined, 2);
}

/**
 * Fetches a quantitative summary of voicemails for a user.
 */
async function fetchVoicemailSummary() {
  const logger = {level: 'info'};

  // eslint-disable-next-line prefer-template
  if (window.voicemail === undefined) {
    voicemail = window.voicemail = CreateVoicemailClient(webex, logger);
    voicemail.init();
  }

  const summary = await voicemail.getVoicemailSummary();
  const summaryStr =JSON.stringify(summary.data.voicemailSummary, undefined, 2);
  summaryContent.innerText = summaryStr.replace(/[\{\}"|"]/g, '');
}

async function getContacts() {
  const contactsList = await contacts.getContacts();
  console.log('Contacts: ', contactsList);
  createContactsTable(contactsList);
}

async function deleteContact(contactId) {
  await contacts.deleteContact(contactId);
  console.log('contact deleted')
  console.log(contacts.groups,contacts.contacts);
};

async function createCloudContact() {
  console.log('Create Cloud Contact');

  const formData = new FormData(cloudContactsElem);

  const contact = {
    phoneNumbers: [{
      type: 'work',
      value: formData.get('phone')
    }],
    contactType: 'CLOUD',
    contactId: formData.get('contactId')
  };

  const res = await contacts.createContact(contact);
  contactObj.innerHTML = 'Status: ' + res.message;
  console.log('Result: ',res);
  console.log(contacts.groups,contacts.contacts);
  cloudContactsElem.reset();
}

async function createCustomContact() {
  console.log('Create Contact');
  const formData = new FormData(contactsElem);
  const contact = {
    avatarURL: formData.get('avatarURL'),
    displayName: formData.get('displayName'),
    phoneNumbers: [{
      type: 'work',
      value: formData.get('phone')
    }],
    emails: [{
      type: 'work',
      value: formData.get('email')
    }],
    contactType: 'CUSTOM',
  };
  const res = await contacts.createContact(contact);
  contactObj.innerHTML = 'Status: '+ res.message;
  console.log('Result: ',res);
  console.log(contacts.groups,contacts.contacts);
  contactsElem.reset();
};

async function createContactGroup(){
  const groupType = contactGroupsElem.elements.groupType.value;
  const res = await contacts.createContactGroup(contactGroupsElem.elements.displayName.value, undefined, groupType);
  contactGroupObj.innerHTML = 'Status: '+ res.message;
  console.log('Result: ',res);
  console.log(contacts.groups,contacts.contacts);
  contactGroupsElem.reset();
};

async function deleteContactGroup(groupId) {
  await contacts.deleteContactGroup(groupId);
  console.log('contact deleted')
  console.log(contacts.groups,contacts.contacts);
};

function toggleButton(eleButton, disableText, enableText) {
  let retVal;
  const element = eleButton;

  if (element.value === 'true') {
    element.classList.replace('btn--green', 'btn--red');
    element.innerHTML = disableText;
    element.value = 'false';
    retVal = false;
  } else {
    element.classList.replace('btn--red', 'btn--green');
    element.innerHTML = enableText;
    element.value = 'true';
    retVal = true;
  }

  return retVal;
}

function fetchLines() {
  line = Object.values(callingClient.getLines())[0];
}

async function fetchDNDSetting() {
  const response = await callSettings.getDoNotDisturbSetting();

  if (response.statusCode === 200) {
    if (response.data.callSetting.enabled === true) {
      dndButton.value = 'false';
    } else {
      dndButton.value = 'true';
    }
    toggleButton(dndButton, 'DND Disabled', 'DND Enabled');
    dndButton.disabled = false;
  }
}

async function toggleDNDSetting() {
  const flag = toggleButton(dndButton, 'DND Disabled', 'DND Enabled');
  const response = await callSettings.setDoNotDisturbSetting(flag);

  if (response.statusCode !== 204) {
    toggleButton(dndButton, 'DND Disabled', 'DND Enabled');
  }
}

async function getCallForwardAlwaysSetting() {
  if (window.callSettings === undefined) {
    callSettings = window.callSettings = CreateCallSettingsClient(webex, logger, enableProd);
  }
  const directoryNumber = directoryNumberCFA.value;
  const response = await callSettings.getCallForwardAlwaysSetting(directoryNumber);
  cfaDataElem.innerHTML = response.data.callSetting || response.data.error ;
}
async function fetchCallWaitingSetting() {
  const response = await callSettings.getCallWaitingSetting();

  if (response.statusCode === 200) {
    if (response.data.callSetting.enabled === true) {
      callWaitingButton.value = 'false';
    } else {
      callWaitingButton.value = 'true';
    }
    toggleButton(callWaitingButton, 'Call Waiting Disabled', 'Call Waiting Enabled');
    callWaitingButton.disabled = true;
  }
}

async function fetchCallForwardSetting() {
  let visibility;

  const response = await callSettings.getCallForwardSetting();

  if (response.statusCode === 200) {
    const {callForwarding, businessContinuity} = response.data.callSetting;
    const form = document.getElementById('callForwardForm');

    form.alwaysCb.checked = callForwarding.always.enabled;
    form.alwaysDest.value = callForwarding.always.destination;
    visibility = form.alwaysCb.checked ? 'initial' : 'none';
    form.alwaysDest.style.display = visibility;
    form.alwaysCb.disabled = false;
    form.alwaysDest.disabled = false;

    form.busyCb.checked = callForwarding.busy.enabled;
    form.busyDest.value = callForwarding.busy.destination;
    visibility = form.busyCb.checked ? 'initial' : 'none';
    form.busyDest.style.display = visibility;
    form.busyCb.disabled = false;
    form.busyDest.disabled = false;

    form.notAnsweredCb.checked = callForwarding.noAnswer.enabled;
    form.notAnsweredDest.value = callForwarding.noAnswer.destination;
    form.notAnsweredRings.value = callForwarding.noAnswer.numberOfRings;
    visibility = form.notAnsweredCb.checked ? 'initial' : 'none';
    form.notAnsweredDest.style.display = visibility;
    form.notAnsweredRings.style.display = visibility;
    form.notAnsweredCb.disabled = false;
    form.notAnsweredDest.disabled = false;
    form.notAnsweredRings.disabled = false;

    form.notReachableCb.checked = businessContinuity.enabled;
    form.notReachableDest.value = businessContinuity.destination;
    visibility = form.notReachableCb.checked ? 'initial' : 'none';
    form.notReachableDest.style.display = visibility;
    form.notReachableCb.disabled = false;
    form.notReachableDest.disabled = false;
  } else {
    console.error('Failed to retrieve call forwarding settings');
  }
}

async function updateCallForwardSetting(form) {
  const requestBody = {
    callForwarding: {
      always: {
        enabled: form.alwaysCb.checked,
        destination: form.alwaysCb.checked ? form.alwaysDest.value : undefined,
      },
      busy: {
        enabled: form.busyCb.checked,
        destination: form.busyCb.checked ? form.busyDest.value : undefined,
      },
      noAnswer: {
        enabled: form.notAnsweredCb.checked,
        destination: form.notAnsweredCb.checked ? form.notAnsweredDest.value : undefined,
        numberOfRings: form.notAnsweredCb.checked ? form.notAnsweredRings.value : undefined,
      },
    },
    businessContinuity: {
      enabled: form.notReachableCb.checked,
      destination: form.notReachableCb.checked ? form.notReachableDest.value : undefined,
    },
  };

  const response = await callSettings.setCallForwardSetting(requestBody);

  if (response.statusCode !== 204) {
    console.error('Failed to save call forwarding settings');
  }
}

async function fetchVoicemailSetting() {
  let visibility;

  const response = await callSettings.getVoicemailSetting();

  if (response.statusCode === 200) {
    const voicemail = response.data.callSetting;
    const form = document.getElementById('voicemailForm');
    const vmCheckbox = document.getElementById('vmCb');
    const vmDiv = document.getElementById('vmDiv');

    vmCheckbox.checked = voicemail.enabled;
    vmCheckbox.disabled = false;
    visibility = vmCheckbox.checked ? 'initial' : 'none';
    vmDiv.style.display = visibility;

    form.alwaysCb.checked = voicemail.sendAllCalls.enabled;
    form.alwaysCb.disabled = false;

    form.busyCb.checked = voicemail.sendBusyCalls.enabled;
    form.busyCb.disabled = false;

    form.vmNotAnsweredCb.checked = voicemail.sendUnansweredCalls.enabled;
    form.vmNotAnsweredRings.value = voicemail.sendUnansweredCalls.numberOfRings;
    visibility = form.vmNotAnsweredCb.checked ? 'initial' : 'none';
    form.vmNotAnsweredRings.style.display = visibility;
    form.vmNotAnsweredCb.disabled = false;
    form.vmNotAnsweredRings.disabled = false;

    form.notifCb.checked = voicemail.messageStorage.mwiEnabled;
    form.notifCb.disabled = false;

    form.notifEmailCb.checked = voicemail.notifications.enabled;
    form.notifEmailId.value = voicemail.notifications.destination;
    visibility = form.notifEmailCb.checked ? 'initial' : 'none';
    form.notifEmailId.style.display = visibility;
    form.notifEmailCb.disabled = false;
    form.notifEmailId.disabled = false;

    form.vmEmailCb.checked = voicemail.emailCopyOfMessage.enabled;
    form.vmEmailId.value = voicemail.emailCopyOfMessage.emailId;
    visibility = form.vmEmailCb.checked ? 'initial' : 'none';
    form.vmEmailId.style.display = visibility;
    form.vmEmailCb.disabled = false;
    form.vmEmailId.disabled = false;
  } else {
    console.error('Failed to retrieve voicemail settings');
  }
}

async function updateVoicemailSetting(form) {
  const vmCheckbox = document.getElementById('vmCb');
  const requestBody = {
    enabled: vmCheckbox.checked,
    sendAllCalls: {
      enabled: form.alwaysCb.checked,
    },
    sendBusyCalls: {
      enabled: form.busyCb.checked,
    },
    sendUnansweredCalls: {
      enabled: form.vmNotAnsweredCb.checked,
      numberOfRings: form.vmNotAnsweredCb.checked ? form.vmNotAnsweredRings.value : undefined,
    },
    notifications: {
      enabled: form.notifEmailCb.checked,
      destination: form.notifEmailCb.checked ? form.notifEmailId.value : undefined,
    },
    emailCopyOfMessage: {
      enabled: form.vmEmailCb.checked,
      emailId: form.vmEmailCb.checked ? form.vmEmailId.value : undefined,
    },
    messageStorage: {
      mwiEnabled: form.notifCb.checked,
    },
  };

  const response = await callSettings.setVoicemailSetting(requestBody);

  if (response.statusCode !== 204) {
    console.error('Failed to save voicemail settings');
  }
}

async function changeElementVisibility(checkboxEle, destEle) {
  const element = destEle;

  if (checkboxEle.checked) {
    element.style.display = 'initial';
  } else {
    element.style.display = 'none';
  }
}

// Separate logic for Safari enables video playback after previously
// setting the srcObject to null regardless if autoplay is set.

window.onload = () => addPlayIfPausedEvents(htmlMediaElements);
