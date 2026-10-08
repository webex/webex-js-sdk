/* eslint-disable no-underscore-dangle */
/* eslint-env browser */

/* global Webex */

/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-global-assign */
/* eslint-disable no-multi-assign */
/* eslint-disable max-len */

// Globals
let webex;
let receiveTranscriptionOption;

let audioReceiveSlot;
let videoReceiveSlot;
let currentActiveSpeakersMemberIds = [];
let isMultistream = false;
let isBrb = false;
// cached state for local microphone and camera muted state
let localMediaMicMuted = undefined;
let localMediaCameraMuted = undefined;
let breakoutSessionConfiguration;
let breakoutSessionsCreated = false;
let breakoutSessionsStarted = false;
let breakoutBroadcastDraft = {
  targetSessionId: 'all',
  role: 'all',
  message: '',
};

const authTypeElm = document.querySelector('#auth-type');
const credentialsFormElm = document.querySelector('#credentials');
const tokenElm = document.querySelector('#access-token');
const saveElm = document.querySelector('#access-token-save');
const authStatusElm = document.querySelector('#access-token-status');
const oauthFormElm = document.querySelector('#oauth');
const oauthLoginElm = document.querySelector('#oauth-login-btn');
const oauthStatusElm = document.querySelector('#oauth-status');
const registerElm = document.querySelector('#registration-register');
const unregisterElm = document.querySelector('#registration-unregister');
const registrationStatusElm = document.querySelector('#registration-status');
const integrationEnv = document.getElementById('integration-env');
const eventsList = document.getElementById('events-list');
const multistreamLayoutElm = document.querySelector('#multistream-layout');
const preferLiveVideoElm = document.querySelector('#prefer-live-video');
const enableBreakoutElm = document.getElementById('enable-breakout');
const breakoutConfigurationElm = document.getElementById('breakout-configuration');
const breakoutAutomaticOptionsElm = document.getElementById('breakout-automatic-options');
const breakoutStatusElm = document.getElementById('breakout-status');
const breakoutCreateButtonElm = document.getElementById('breakout-create-sessions');
const breakoutStartButtonElm = document.getElementById('breakout-start-sessions');
const breakoutResetButtonElm = document.getElementById('breakout-reset-sessions');
const breakoutTableElm = document.getElementById('breakout-table');
const getStatsButton = document.getElementById('get-stats');
const tcpReachabilityConfigElm = document.getElementById('enable-tcp-reachability');
const tlsReachabilityConfigElm = document.getElementById('enable-tls-reachability');

const guestName = document.querySelector('#guest-name');
const getGuestToken = document.querySelector('#get-guest-token');
const voiceaSpokenLanguage = document.querySelector('#voicea-spoken-language');
const voiceaCaptionLanguage = document.querySelector('#voicea-caption-language');
const voiceaSpokenLanguageBtn = document.querySelector('#voicea-spoken-language-btn');
const voiceaCaptionLanguageBtn = document.querySelector('#voicea-caption-language-btn');
const voiceaTranscriptionTemplate = document.querySelector('#voicea-transcription-template');
const voiceaTranscriptionFormattedDisplay = document.querySelector('#voicea-transcription-formatted-display');


const toggleUnifiedMeetings = document.getElementById('toggle-unified-meeting');
const currentMeetingInfoStatus = document.getElementById('current-meeting-info-status');

const enableLLM = document.getElementById('meetings-enable-llm');
const enableTranscript = document.getElementById('meetings-enable-transcription');
const spokenLangNote = document.getElementById('only-host-spoken-language');

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


const fedRampInput = document.querySelector('#enable-fedramp');

fedRampInput.checked = false;

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

function generateWebexConfig({credentials}) {
  return {
    appName: 'sdk-samples',
    appPlatform: 'testClient',
    fedramp: fedRampInput.checked,
    logger: {
      level: 'debug'
    },
    ...(integrationEnv.checked && {
      services: {
        discovery: {
          u2c: 'https://u2c-intb.ciscospark.com/u2c/api/v1',
          hydra: 'https://hydra-intb.ciscospark.com/v1/'
        }
      }
    }),
    meetings: {
      reconnection: {
        enabled: true
      },
      enableRtx: true,
      experimental: {
        enableMediaNegotiatedEvent: false,
        enableUnifiedMeetings: true,
        enableAdhocMeetings: true,
      },
      enableReachabilityChecks: {
        tcp: tcpReachabilityConfigElm.checked,
        tls: tlsReachabilityConfigElm.checked,
      },
      enableAutomaticLLM: enableLLM.checked,
    },
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
        client_id: 'C7c3f1143a552d88d40b2afff87600c366c830850231597fb6c1c1e28a5110a4f',
        redirect_uri: redirectUri,
        scope: 'spark:all spark:kms'
      }
    })
  });

  localStorage.setItem('OAuth', true);

  webex.once('ready', () => {
    oauthFormElm.addEventListener('submit', (event) => {
      event.preventDefault();
      const isIframe = window !== window.parent;

      if (isIframe) {
        webex.authorization.initiateLogin({  separateWindow: {
          width: 800,
          height: 600,
          // You can also add other window features
          menubar: 'no',
          toolbar: 'no',
          location: 'yes'
        } });
      } else {
        webex.authorization.initiateLogin();
      }

      // initiate the login sequence if not authenticated.

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
  getGuestToken.disabled = true;
  guestName.disable = true;
  authStatusElm.innerText = 'initializing...';

  webex = window.webex = Webex.init({
    config: generateWebexConfig({}),
    credentials: {
      access_token: tokenElm.value
    }
  });

  webex.once('ready', () => {
    console.log('Authentication#initWebex() :: Webex Ready');
    registerElm.disabled = false;
    authStatusElm.innerText = 'Saved access token!';
    currentMeetingInfoStatus.innerText = webex.meetings.config.experimental.enableUnifiedMeetings ? 'V2' : 'V1';
    registerElm.classList.add('btn--green');
  });

  return false;
}
credentialsFormElm.addEventListener('submit', initWebex);


function register() {
  console.log('Authentication#register()');
  registerElm.disabled = true;
  unregisterElm.disabled = true;
  registrationStatusElm.innerText = 'Registering...';

  webex.meetings.register()
    .then(() => {
      console.log('Authentication#register() :: successfully registered');
      toggleUnifiedMeetings.removeAttribute('disabled');
      unregisterElm.disabled = false;
      unregisterElm.classList.add('btn--red');
    })
    .catch((error) => {
      console.warn('Authentication#register() :: error registering', error);
      registerElm.disabled = false;
    })
    .finally(() => {
      registrationStatusElm.innerText = webex.meetings.registered ?
        'Registered' :
        'Not Registered';
    });

  webex.meetings.on('meeting:added', (m) => {
    const {type} = m;
    console.log("meeting:added============================>test");

    if (type === 'INCOMING') {
      const newMeeting = m.meeting;

      toggleDisplay('incomingsection', true);
      newMeeting.acknowledge(type);
    }

    handleStreamPublishedState(m.meeting);
  });
}

function unregister() {
  console.log('Authentication#unregister()');
  registerElm.disabled = true;
  unregisterElm.disabled = true;
  registrationStatusElm.innerText = 'Unregistering...';

  webex.meetings.unregister()
    .then(() => {
      console.log('Authentication#register() :: successfully unregistered');
      registerElm.disabled = false;
    })
    .catch((error) => {
      console.warn('Authentication#register() :: error unregistering', error);
      unregisterElm.disabled = false;
    })
    .finally(() => {
      registrationStatusElm.innerText = webex.meetings.regisered ?
        'Registered' :
        'Not Registered';
    });
}


async function getGuestAccessToken() {

  await axios({
    method: 'post',
    url: 'https://2j1g168nf8.execute-api.us-east-1.amazonaws.com/dev/guest',
    data: {
      name: guestName.value
    }
  }).then(function (response) {
    console.log("guest token response", response.data.body.token);
    tokenElm.value = response.data.body.token
  }).catch((e) =>{
    console.error("Error fetching guest", e)
  })

}

// Meetings Management Section --------------------------------------------------
const createMeetingForm = document.querySelector('#meetings-create');
const createMeetingDestinationElm = document.querySelector('#create-meeting-destination');
const createMeetingSelectElm = document.querySelector('#createMeetingDest');
const createMeetingActionElm = document.querySelector('#create-meeting-action');
const meetingsJoinDeviceElm = document.querySelector('#meetings-join-device');
const meetingsJoinPinElm = document.querySelector('#meetings-join-pin');
const meetingsJoinModeratorElm = document.querySelector('#meetings-join-moderator');
const meetingsBreakoutSupportElm = document.querySelector('#meetings-join-breakout-enabled');
const meetingsSISupportElm = document.querySelector('#meetings-join-si-enabled');
const meetingsMediaInLobbySupportElm = document.querySelector('#meetings-media-in-lobby-enabled');
const meetingsJoinMultistreamElm = document.querySelector('#meetings-join-multistream');
const meetingsListCollectElm = document.querySelector('#meetings-list-collect');
const meetingsListMsgElm = document.querySelector('#meetings-list-msg');
const meetingsListElm = document.querySelector('#meetings-list');
const meetingsAddMediaElm = document.querySelector('#meetings-add-media');
const meetingsLeaveElm = document.querySelector('#meetings-leave');
// captcha elements
const meetingsJoinCaptchaImgElm = document.querySelector('#meetings-join-captcha');
const meetingsJoinCaptchaElm = document.querySelector('#meetings-join-captcha-input');
const passwordCaptchaStatusElm = document.querySelector('#password-captcha-status');
const refreshCaptchaElm = document.querySelector('#meetings-join-captcha-refresh');
const verifyPasswordElm = document.querySelector('#btn-verify-password');
const displayMeetingStatusElm = document.querySelector('#display-meeting-status');
const notes=document.querySelector('#notes');
const spaceIDError = `Using the space ID as a destination is no longer supported. Please refer to the <a href="https://github.com/webex/webex-js-sdk/wiki/Migration-to-Unified-Space-Meetings" target="_blank">migration guide</a> to migrate to use the meeting ID or SIP address.`;
const blurVBGImageUrl = './assets/vbg_image.jpg'
const blurVBGVideoUrl = './assets/clouds.5b57454a.mp4'

let selectedMeetingId = null;
let currentMediaSettings = {};

function setSelectedMeetingId(e) {
  selectedMeetingId = e.target.value;
  meeting = webex.meetings.getAllMeetings()[selectedMeetingId];
}

function generateMeetingsListItem(meeting) {
  const itemElm = document.createElement('div');
  const detailsElm = document.createElement('label');
  const joinInputElm = document.createElement('input');

  joinInputElm.type = 'radio';
  joinInputElm.name = 'meeting';
  joinInputElm.value = meeting.id;
  joinInputElm.id = `meeting-${meeting.id}`;
  joinInputElm.onclick = setSelectedMeetingId;

  itemElm.id = `meeting-list-item-${meeting.id}`;
  itemElm.key = meeting.id;

  detailsElm.setAttribute('for', joinInputElm.id);
  detailsElm.innerText = meeting.sipUri || meeting.id || meeting.destination;

  itemElm.appendChild(joinInputElm);
  itemElm.appendChild(detailsElm);

  return itemElm;
}

function refreshMeetings() {
  const meetings = webex.meetings.getAllMeetings();

  console.log('MeetingsManagement#refreshMeetings', meetings);
  meetingsListElm.innerHTML = '';

  Object.keys(meetings).forEach(
    (key) => {
      meetingsListElm.appendChild(
        generateMeetingsListItem(meetings[key])
      );
    }
  );

  if (meetingsListElm.childElementCount > 0) {
    meetingsListMsgElm.hidden = true;
  }
  else {
    meetingsListMsgElm.hidden = false;
  }
}


function collectMeetings() {
  console.log('MeetingsManagement#collectMeetings()');

  webex.meetings.syncMeetings()
    .then(() => new Promise((resolve) => {
      setTimeout(() => resolve(), 200);
    }))
    .then(() => {
      console.log('MeetingsManagement#collectMeetings() :: successfully collected meetings');
      refreshMeetings();
    });
}

createMeetingSelectElm.addEventListener('change', (event) => {
  if (event.target.value === 'CONVERSATION_URL') {
    createMeetingActionElm.innerText = 'Create Adhoc Meeting using conversation URL (INTERNAL-USE ONLY)';
  }
  else {
    createMeetingActionElm.innerText = 'Create Meeting';
  }
});

createMeetingSelectElm.addEventListener('change', (event) => {
  if (event.target.value === 'Others') {
      notes.classList.remove('hidden');
  }
  else {
     notes.classList.add('hidden');

  }
});


function createMeeting(e) {
  e.preventDefault();

  meetingsJoinCaptchaImgElm.hidden = true;
  meetingsJoinCaptchaElm.type = 'hidden';
  refreshCaptchaElm.hidden = true;
  const {value} = createMeetingDestinationElm;
  const type = createMeetingSelectElm.value;

  console.log('MeetingsManagement#createMeeting', value);

  webex.meetings.create(value, type)
    .then((meeting) => {
      createMeetingDestinationElm.value = '';
      displayMeetingStatusElm.innerHTML = '';
      refreshMeetings();
    }).catch((error) => {
      if(error.code === 30105){
        displayMeetingStatusElm.innerHTML = spaceIDError;
      }
    });

  return false;
}

function refreshCaptcha() {
  const meeting = webex.meetings.getAllMeetings()[selectedMeetingId];

  meeting.refreshCaptcha()
    .then(() => {
      console.log('MeetingsManagement#refreshCaptcha() :: successfully refreshed captcha');
      meetingsJoinCaptchaImgElm.src = meeting.requiredCaptcha.verificationImageURL;
      meetingsJoinCaptchaImgElm.hidden = false;
      meetingsJoinCaptchaElm.type = 'text';
      meetingsJoinCaptchaElm.value = '';
      refreshCaptchaElm.hidden = false;
    })
    .catch((error) => {
      console.error('MeetingsManagement#refreshCaptcha() :: error refreshing captcha', error);
      throw (error);
    });
}

meetingsListElm.onclick = (e) => {
  selectedMeetingId = e.target.value;
  const meeting = webex.meetings.getAllMeetings()[selectedMeetingId];
  const selectedMeetingType = createMeetingSelectElm.options[createMeetingSelectElm.selectedIndex].innerText;

  if (meeting && meeting.passwordStatus === 'REQUIRED') {
    meetingsJoinPinElm.disabled = false;
    verifyPasswordElm.disabled = false;
    document.getElementById('btn-join').disabled = true;
    document.getElementById('btn-join-media').disabled = true;
  }
  else if (meeting && (meeting.passwordStatus === 'UNKNOWN' && selectedMeetingType === 'SIP URI')) {
    meetingsJoinPinElm.disabled = true;
    verifyPasswordElm.disabled = true;
    document.getElementById('btn-join').disabled = true;
    document.getElementById('btn-join-media').disabled = true;
  }
  else if(meeting && (meeting.passwordStatus === 'UNKNOWN' && selectedMeetingType != 'SIP URI')) {
    meetingsJoinPinElm.disabled = true;
    verifyPasswordElm.disabled = true;
    document.getElementById('btn-join').disabled = false;
    document.getElementById('btn-join-media').disabled = false;
  }
  else {
    meetingsJoinPinElm.disabled = true;
    verifyPasswordElm.disabled = true;
    document.getElementById('btn-join').disabled = false;
    document.getElementById('btn-join-media').disabled = false;
  }
};

function verifyPassword() {
  const meeting = webex.meetings.getAllMeetings()[selectedMeetingId];

  if (!meeting) {
    throw new Error(`meeting ${selectedMeetingId} is invalid or no longer exists`);
  }

  const joinOptions = {
    pin: meetingsJoinPinElm.value,
    captcha: meetingsJoinCaptchaElm.value
  };

  if (meeting && meeting.passwordStatus === 'REQUIRED') {
    meeting
      .verifyPassword(joinOptions.pin, joinOptions.captcha)
      .then((res) => {
        /* we have a bug in the SDK code: for case if wbxappapi requires only captcha and no password */
        if (res.isPasswordValid) {
          passwordCaptchaStatusElm.innerText = 'Password is verified';
          passwordCaptchaStatusElm.style.backgroundColor = '#49e849';
          verifyPasswordElm.disabled = true;
          document.getElementById('btn-join').disabled = false;
          document.getElementById('btn-join-media').disabled = false;
        }
        else if (res.requiredCaptcha) {
          passwordCaptchaStatusElm.innerText = 'Password & Captcha is required';
          passwordCaptchaStatusElm.style.backgroundColor = '#fa6e6e';
          meetingsJoinCaptchaImgElm.src = res.requiredCaptcha.verificationImageURL;
          meetingsJoinCaptchaImgElm.hidden = false;
          meetingsJoinCaptchaElm.type = 'text';
          refreshCaptchaElm.hidden = false;
        }
        else {
          passwordCaptchaStatusElm.innerText = 'Password is required';
          passwordCaptchaStatusElm.style.backgroundColor = '#fa6e6e';
        }
      })
      .catch((err) => {
        console.log('error', err);
        throw (err);
      });
  }
}

/**
 * This function should be called before media connection is added to the meeting.
 * It sets up the sample app's UI and listeners for media related events
 * @param {Meeting} meeting
 */
function doPreMediaSetup(meeting) {
  if (isMultistream) {
    updateRemoteSourcesInfo();
    setupMultistreamEventListeners(meeting);

    // we can't import anything so can't read the initialLayoutId from the DefaultConfiguration that we're using
    // so we need to hardcode it like this:
    multistreamLayoutElm.value = 'AllEqual';
    preferLiveVideoElm.value = 'Enable';
  }
  else {
    console.log('MeetingStreams#doPreMediaSetup() :: registering for media:ready and media:stopped events');

    // Wait for media in order to show video/share
    meeting.on('media:ready', (media) => {
      // eslint-disable-next-line default-case
      switch (media.type) {
        case 'remoteVideo':
          meetingStreamsRemoteVideo.srcObject = media.stream;
          updateLayoutHeightWidth();
          break;
        case 'remoteAudio':
          meetingStreamsRemoteAudio.srcObject = media.stream;
          break;
        case 'remoteShare':
          meetingStreamsRemoteShare.srcObject = media.stream;
          break;
      }
    });

    // remove stream if media stopped
    meeting.on('media:stopped', (media) => {
      // eslint-disable-next-line default-case
      switch (media.type) {
        case 'remoteVideo':
          meetingStreamsRemoteVideo.srcObject = null;
          break;
        case 'remoteAudio':
          meetingStreamsRemoteAudio.srcObject = null;
          break;
        case 'remoteShare':
          meetingStreamsRemoteShare.srcObject = null;
          break;
      }
    });
  }
}

/**
 * This function should be called after media connection is added to the meeting.
 * It sets up the sample app's UI, etc.
 *
 * @param {Meeting} meeting
 */
function doPostMediaSetup(meeting) {
  if (isMultistream) {
    enableMultistreamControls(true);

    // we need to check shareStatus, because may have missed the 'meeting:startedSharingRemote' event
    // if someone started sharing before our page was loaded,
    // or we didn't act on that event if the user clicked "add media" while being in the lobby
    if (meeting.shareStatus === 'remote_share_active') {
      forceScreenShareViewLayout(meeting);
    }
  } else {
    remoteVideoResolutionCheckInterval();
  }

  localVideoResolutionCheckInterval();

  // enabling screen share publish/unpublish buttons
  publishShareBtn.disabled = false;
  unpublishShareBtn.disabled = false;

  currentMediaSettings = getMediaSettings();
}

async function joinMeeting({withMedia, withDevice} = {withMedia: false, withDevice: false}) {
  const meeting = webex.meetings.getAllMeetings()[selectedMeetingId];

  meeting.on('meeting:transcription:connected', () => {
    if (enableTranscript.checked) {
      toggleTranscription(true);
    }
  });

  let resourceId = null;

  if (!meeting) {
    throw new Error(`meeting ${selectedMeetingId} is invalid or no longer exists`);
  }

  if (withDevice) {
    resourceId = webex.devicemanager._pairedDevice ?
      webex.devicemanager._pairedDevice.identity.id :
      undefined;

    clearMediaDeviceList();
    getMediaDevices();
  }

  isMultistream = meetingsJoinMultistreamElm.checked;

  // after join is started, user cannot toggle multistream on or off
  meetingsJoinMultistreamElm.disabled = true;

  const joinOptions = {
    enableMultistream: isMultistream,
    pin: meetingsJoinPinElm.value,
    moderator: meetingsJoinModeratorElm.checked,
    breakoutsSupported: meetingsBreakoutSupportElm.checked,
    enableSimultaneousInterpretation: meetingsSISupportElm.checked,
    moveToResource: false,
    resourceId,
    locale: 'en_UK', // audio disclaimer language
    deviceCapabilities: ['SERVER_AUDIO_ANNOUNCEMENT_SUPPORTED'], // audio disclaimer toggle
  };

  if (meetingsMediaInLobbySupportElm.checked) {
    joinOptions.deviceCapabilities.push('CONFLUENCE_IN_LOBBY_SUPPORTED');
  }

  if (!meeting.requiredCaptcha) {
    joinOptions.captcha = '';
  }

  try {

    if (!withMedia) {
      await meeting.join(joinOptions);
    }
    else {
      clearMediaDeviceList();

      const mediaSettings = getMediaSettings()

      await getUserMedia({
        audio: mediaSettings.audioEnabled,
        video: mediaSettings.videoEnabled
      });

      doPreMediaSetup(meeting);

      // we're using the default RemoteMediaManagerConfig
      const mediaOptions = {
        localStreams: {
          microphone: localMedia.microphoneStream,
          camera: localMedia.cameraStream,
          screenShare: {
            audio: localMedia.screenShare?.audio,
            video: localMedia.screenShare?.video
          }
        },
        ...getMediaSettings()
      };

      await meeting.joinWithMedia({joinOptions, mediaOptions});

      doPostMediaSetup(meeting);
    }

    enableMeetingDependentButtons(true);

    // For meeting controls button onclick handlers
    window.meeting = meeting;

    updateMeetingInfoSection(meeting);

    meeting.members.on('members:update', (res) => {
      console.log('member update', res);
      viewParticipants();
      populateStageSelector();
    });

    meeting.on('meeting:breakouts:update', () => {
      refreshBreakoutSessions();
    });

    meeting.on('meeting:stoppedSharingRemote', () => {
      /**
       * Here we first remove the media to stop showing the remote stream being received and again
       * attach the remote media stream (which gets added during addMedia() call) but since the remote
       * is not sending the frames anymore it does not show the screenshare but keeps the event attached.
       * Hence, when we again start sharing the screen, the media flows correctly to the video element.
       */
      const remoteShareTemp = meetingStreamsRemoteShare.srcObject;
      meetingStreamsRemoteShare.srcObject = null;
      meetingStreamsRemoteShare.srcObject = remoteShareTemp;
    });

    meeting.on('meeting:self:mutedByOthers', () => {
      handleAudioButton();
    });

    meeting.on('meeting:self:unmutedByOthers', () => {
      handleAudioButton();
    });

    eventsList.innerText = '';
    meeting.on('all', (payload) => {
      updatePublishedEvents(payload);
    });

  } catch(err) {
    console.error(`failed to join a meeting (withMedia=${withMedia} withDevice=${withDevice}): `, err);
    // join failed, so allow  user decide on multistream again
    meetingsJoinMultistreamElm.disabled = false;
  };
}

function leaveMeeting(meetingId) {
  if (!meetingId) {
    return;
  }

  const meeting = webex.meetings.getAllMeetings()[meetingId];

  if (!meeting) {
    throw new Error(`meeting ${meetingId} is invalid or no longer exists`);
  }

  meeting.leave()
    .then(() => {
      meetingsLeaveElm.classList.remove('btn--red');
      toggleDisplay('meeting-info-section', false);
      clearAllMultistreamVideoElements();
      // eslint-disable-next-line no-use-before-define
      cleanUpMedia();
      emptyParticipants();
      meetingsJoinCaptchaImgElm.hidden = true;
      meetingsJoinCaptchaElm.type = 'hidden';
      refreshCaptchaElm.hidden = true;
      passwordCaptchaStatusElm.innerText = 'Click verifyPassword for details';
      passwordCaptchaStatusElm.style.backgroundColor = 'white';
      meetingsJoinPinElm.value = '';
      meetingsJoinCaptchaElm.value = '';
      meetingsJoinMultistreamElm.disabled = false;
      enableMultistreamControls(false);
      enableBreakoutElm.checked = false;
      breakoutConfigurationElm.classList.add('hidden');
      resetBreakoutSessions();
      setBreakoutStatus('');
      clearVideoResolutionCheckInterval(remoteVideoResElm, remoteVideoResolutionInterval);
      // disabling screen share publish/unpublish buttons
      publishShareBtn.disabled = true;
      unpublishShareBtn.disabled = true;
      enableMeetingDependentButtons(false);
      clearSipCalloutFields();
    });
}

function updatePublishedEvents(event) {
  // skip network:quality
  if (event === 'network:quality') return;

  const par = document.createElement('p');
  const currTime = new Date();

  let hours = currTime.getHours();
  let minutes = currTime.getMinutes();
  let seconds = currTime.getSeconds();

  if (hours < 10) {
    hours = `0${hours}`;
  }
  if (minutes < 10) {
    minutes = `0${minutes}`;
  }
  if (seconds < 10) {
    seconds = `0${seconds}`;
  }

  par.innerText = `${hours}:${minutes}:${seconds} - ${event}`;
  eventsList.appendChild(par);
}

function toggleMeetingInfo() {
  const changeState = !webex.meetings.config.experimental.enableUnifiedMeetings;

  webex.meetings._toggleUnifiedMeetings(changeState);
  currentMeetingInfoStatus.innerText = (changeState === true) ? 'V2' : 'V1';
}
// Listen for submit on create meeting
createMeetingForm.addEventListener('submit', createMeeting);

function updateMeetingInfoSection(meeting) {
  const titleElm = document.getElementById('meeting-info-title');
  const subtitleElm = document.getElementById('meeting-info-subtitle');

  titleElm.innerText = meeting.destination.info ? meeting.destination?.info?.webExMeetingName : meeting.destination;
  if (titleElm.innerText === 'undefined') {
    titleElm.innerText = meeting.destination?.host?.name;
  }
  subtitleElm.innerText = `${meeting.sipUri} (${meeting.id})`;

  meetingsLeaveElm.onclick = () => leaveMeeting(getCurrentMeeting().id);
  meetingsLeaveElm.classList.add('btn--red');

  toggleDisplay('meeting-info-section', true);
}

// Meeting Controls Section --------------------------------------------------

const generalControlsForm = document.querySelector('#general-controls');
const generalControlsLockElm = document.querySelector('#gc-lock');
const generalControlsUnlockElm = document.querySelector('#gc-unlock');
const generalControlsLockStatus = document.querySelector('#gc-lock-status');
const generalControlsMeetingsList = document.querySelector('#gc-meetings-list');
const generalControlsRecStatus = document.querySelector('#gc-recording-status');
const generalControlsDtmfTones = document.querySelector('#gc-dtmf-tones');
const generalControlsDtmfStatus = document.querySelector('#gc-dtmf-status');
const generalToggleTranscription = document.querySelector('#gc-toggle-transcription');
const generalTranscriptionContent = document.querySelector('#gc-transcription-content');

const sourceDevicesGetMedia = document.querySelector('#sd-get-media-devices');
const sourceDevicesAudioInput = document.querySelector('#sd-audio-input-devices');
const sourceDevicesAudioOutput = document.querySelector('#sd-audio-output-devices');
const sourceDevicesVideoInput = document.querySelector('#sd-video-input-devices');
const sourceDeviceControls = document.querySelector('#source-devices-controls');
const receivingSourcesControls = document.querySelector('#receiving-sources-controls');
const audioInputDeviceStatus = document.querySelector('#sd-audio-input-device-status');
const audioOutputDeviceStatus = document.querySelector('#sd-audio-output-device-status');
const videoInputDeviceStatus = document.querySelector('#sd-video-input-device-status');

const meetingStreamsLocalVideo = document.querySelector('#local-video');
const meetingStreamsLocalAudio = document.querySelector('#local-audio');
const meetingStreamsRemoteVideo = document.querySelector('#remote-video');
const meetingStreamsRemoteAudio = document.querySelector('#remote-audio');
const meetingStreamsLocalShareVideo = document.querySelector('#local-screenshare-video');
const meetingStreamsLocalShareAudio = document.querySelector('#local-screenshare-audio');
const meetingStreamsRemoteShare = document.querySelector('#remote-screenshare');
const layoutWidthInp = document.querySelector('#layout-width');
const layoutHeightInp = document.querySelector('#layout-height');
const localResolutionInp = document.getElementById('local-resolution');
const remoteResolutionInp = document.getElementById('remote-resolution');
const localVideoResElm = document.getElementById('local-video-resolution');
const remoteVideoResElm = document.getElementById('remote-video-resolution');


const toggleSourcesMediaDirection = document.querySelectorAll('[name=ts-media-direction]');
const toggleAdditionalMediaDirection = document.querySelectorAll('[name=ts-additional-media-direction]');
const toggleSourcesQualityStatus = document.querySelector('#ts-sending-quality-status');
const toggleSourcesMeetingLevel = document.querySelector('#ts-sending-qualities-list');

const loadCameraBtn = document.querySelector('#ts-load-camera');
const toggleVbgBtn = document.querySelector('#ts-enable-VBG');
const loadMicrophoneBtn = document.querySelector('#ts-load-mic');
const noiseReductionBtn = document.querySelector('#ts-noise-reduction-btn');
const startShareBtn = document.querySelector('#ts-start-screenshare');
const publishShareBtn = document.querySelector('#ts-publish-screenshare');
const unpublishShareBtn = document.querySelector('#ts-unpublish-screenshare');
const stopShareBtn = document.querySelector('#ts-stop-screenshare');
const toggleAudioButton = document.querySelector('#ts-toggle-audio');
const stopVideoButton = document.querySelector('#ts-stop-video');
const stopAudioButton = document.querySelector('#ts-stop-audio');
const muteVideoMessage = document.querySelector('#ts-mute-video-message');
const muteAudioMessage = document.querySelector('#ts-mute-audio-message');
const defaultShareMessage = document.querySelector('#ts-default-share-message');
const brbShareMessage = document.querySelector('#ts-brb-share-message');
const modeBtn = document.getElementById('mode-type');

/**
 * Enables and disables the UI elements specific to multistream or transcoded connections
 * based on the "Use a multistream connection" checkbox
 */
function updateMultistreamUI() {
  const multistreamEnabled = meetingsJoinMultistreamElm.checked;

  document.getElementById('meeting-quality').disabled = multistreamEnabled;

  if (multistreamEnabled) {
    document.getElementById('remote-transcoded-video-wrapper').classList.add('hidden');
    document.getElementById('remote-transcoded-screenshare-wrapper').classList.add('hidden');

    document.getElementById('multistream-remote-streams').classList.remove('hidden');
  }
  else {
    document.getElementById('remote-transcoded-video-wrapper').classList.remove('hidden');
    document.getElementById('remote-transcoded-screenshare-wrapper').classList.remove('hidden');

    document.getElementById('multistream-remote-streams').classList.add('hidden');
  }
}

// NOTE: remember to set currentMediaSettings after promises resolves in the case when below method is used
function getMediaSettings(compareLastSettings = false) {
  const settings = {};
  const additionalMediaOptions = {};

  toggleSourcesMediaDirection.forEach((options) => {
    if (compareLastSettings) {
      if (currentMediaSettings[options.value] !== options.checked) {
        settings[options.value] = options.checked;
      }
    } else {
      settings[options.value] = options.checked;
    }
  });
  toggleAdditionalMediaDirection.forEach((options)=>{
      additionalMediaOptions[options.value] = options.checked;
  }
  )
  settings.additionalMediaOptions = additionalMediaOptions;
  settings.allowMediaInLobby = meetingsMediaInLobbySupportElm.checked;
  settings.bundlePolicy = 'max-bundle';

  return settings;
}

// reset will make all media toggles as default checked(in case of addMedia() failure as it is the initial case)
function resetMediaSettingsToDefaults() {
  toggleSourcesMediaDirection.forEach((options) => {
    options.checked = true;
  })
}

// in case add/update media function fails then we need to restore the previous media setting toggles
function revertMediaSettings(changedMediaSettings) {
  delete changedMediaSettings.allowMediaInLobby;
  delete changedMediaSettings.bundlePolicy;

  for (const setting in changedMediaSettings) {
    let element = document.querySelector(`[value=${setting}]`);
    element.checked = !element.checked;
  };
}

const htmlMediaElements = [
  meetingStreamsLocalVideo,
  meetingStreamsLocalAudio,
  meetingStreamsLocalShareVideo,
  meetingStreamsLocalShareAudio,
  meetingStreamsRemoteVideo,
  meetingStreamsRemoteShare,
  meetingStreamsRemoteAudio
];


function cleanUpMedia() {
  // local streams can be used across meetings
  [
    meetingStreamsRemoteVideo,
    meetingStreamsRemoteShare,
    meetingStreamsRemoteAudio
  ].forEach((elem) => {
    if (elem.srcObject) {
      elem.srcObject.getTracks().forEach((track) => track.stop());
      // eslint-disable-next-line no-param-reassign
      elem.srcObject = null;

      if(elem.id === "local-video") {
        clearVideoResolutionCheckInterval(localVideoResElm, localVideoResolutionInterval);
      }
    }
  });
}

/*
 * Fixes a safari related video playback issue where the autoplay
 * attribute does not play the video stream after the srcObject
 * has been previously set to null.
 *
 * The canplaythrough event is fired when the user agent can play the media,
 * and estimates that enough data has been loaded to play the media. When this
 * event is fired we then manually play the video if paused. This fixes the Safari
 * play issue above, allowing the video to play when new stream is added.
 */
function addPlayIfPausedEvents(mediaElements) {
  mediaElements.forEach((elem) => {
    elem.addEventListener('canplaythrough', (event) => {
      console.log('playVideoIfPaused#canplaythrough :: Play started', elem);
      if (elem.paused) elem.play();
    });
  });
}

function getCurrentMeeting() {
  return webex?.meetings?.getAllMeetings()[selectedMeetingId];
}

function lockMeeting() {
  const meeting = getCurrentMeeting();

  console.log('MeetingControls#lockMeeting()');
  if (meeting) {
    generalControlsLockStatus.innerText = 'Locking meeting...';
    meeting.lockMeeting()
      .then(() => {
        generalControlsLockStatus.innerText = 'Meeting locked!';
        console.log('MeetingControls#lockMeeting() :: successfully locked meeting');
      })
      .catch((error) => {
        generalControlsLockStatus.innerText = 'Error! See console for details.';
        console.log('MeetingControls#lockMeeting() :: unable to lock meeting');
        console.error(error);
      });
  }
  else {
    console.log('MeetingControls#lockMeeting() :: no valid meeting object!');
  }
}

function unlockMeeting() {
  const meeting = getCurrentMeeting();

  if (meeting) {
    console.log('MeetingControls#unlockMeeting()');
    generalControlsLockStatus.innerText = 'Unlocking meeting...';
    meeting.unlockMeeting()
      .then(() => {
        generalControlsLockStatus.innerText = 'Meeting unlocked!';
        console.log('MeetingControls#unlockMeeting() :: successfully unlocked meeting');
      })
      .catch((error) => {
        generalControlsLockStatus.innerText = 'Error! See console for details.';
        console.log('MeetingControls#unlockMeeting() :: unable to unlock meeting.');
        console.error(error);
      });
  }
  else {
    console.log('MeetingControls#unlockMeeting() :: no valid meeting object!');
  }
}

function startRecording() {
  const meeting = getCurrentMeeting();

  if (meeting) {
    console.log('MeetingControls#startRecording()');
    generalControlsRecStatus.innerText = 'Recording meeting...';
    meeting.startRecording()
      .then(() => {
        generalControlsRecStatus.innerText = 'Meeting is being recorded!';
        console.log('MeetingControls#startRecording() :: meeting recording started!');
      })
      .catch((error) => {
        generalControlsRecStatus.innerText = 'Error! See console for details.';
        console.log('MeetingControls#startRecording() :: unable to record meeting.');
        console.error(error);
      });
  }
  else {
    console.log('MeetingControls#startRecording() :: no valid meeting object!');
  }
}

function fillLanguageDropDowns(dropdown, list){
  for(var i = 0; i < list.length; i++) {
      // Create a new option element
      var option = document.createElement("option");

      // Set the value and text of the option
      option.value = list[i];
      option.text = list[i];

      // Add the option to the dropdown
      dropdown.appendChild(option);
  }
}

async function setSpokenLanguage() {
  const meeting = getCurrentMeeting();
  voiceaSpokenLanguageBtn.disabled = true;
  const selectedLanguage = voiceaSpokenLanguage.value;
  try{
    await meeting.setSpokenLanguage(selectedLanguage);
    voiceaSpokenLanguageBtn.disabled = false;
  }
  catch(e){
    console.error("Error setting spoken language", e);
  }
}

async function setCaptionLanguage() {
  const meeting = getCurrentMeeting();
  voiceaCaptionLanguageBtn.disabled = true;
  const selectedLanguage = voiceaCaptionLanguage.value;
  try{
    await meeting.setCaptionLanguage(selectedLanguage);
    voiceaCaptionLanguageBtn.disabled = false;
  }
  catch(e){
    console.error("Error setting caption language", e);
  }
}

function stopReceivingTranscription() {
  const meeting = getCurrentMeeting();

  generalStopReceivingTranscription.disabled = true;
  meeting.stopReceivingTranscription();
}

async function toggleTranscription(enable = false){
  const isEnabled = generalToggleTranscription.dataset.enabled === "true";
  if(isEnabled && !enable){
    try{
      await meeting.stopTranscription();
      generalToggleTranscription.dataset.enabled = "false";
      generalToggleTranscription.innerText = "Start Transcription";
    }
    catch(e){
      console.error("Error stopping transcription", e);
    }
  }
  else{
    let firsttime = generalToggleTranscription.dataset.firsttime;
    if(firsttime === undefined){
      setTranscriptEvents();
      generalToggleTranscription.dataset.firsttime = "yes";
    }
    try{
      await meeting.startTranscription();
      generalToggleTranscription.dataset.enabled = "true";
      generalToggleTranscription.innerText = "Stop Transcription";
    }
    catch(e){
      console.error("Error starting transcription", e);
    }
  }
}

function setTranscriptEvents() {
  const meeting = getCurrentMeeting();

  if (meeting) {
    Handlebars.registerHelper("forIn", function(object) {
      let returnArray = [];
      for(let prop in object){
        returnArray.push({key: prop, value: object[prop]});
      }
      return returnArray;
    });
    var transcriptTemplate = Handlebars.compile(voiceaTranscriptionTemplate.innerHTML);

    generalTranscriptionContent.innerHTML = '';

    meeting.on('meeting:receiveTranscription:started', (payload) => {
      fillLanguageDropDowns(voiceaCaptionLanguage,payload.captionLanguages);
      if(typeof payload.spokenLanguages !== "undefined" && meeting.getCurUserType() === "host"){
        fillLanguageDropDowns(voiceaSpokenLanguage,payload.spokenLanguages);
        voiceaSpokenLanguage.disabled = false;
        voiceaSpokenLanguageBtn.disabled = false;
      }
      else {
        spokenLangNote.classList.remove("hidden");
      }
      voiceaCaptionLanguage.disabled = false;
      voiceaCaptionLanguageBtn.disabled = false;
    });

    meeting.on('meeting:caption-received', (payload) => {
      generalTranscriptionContent.innerHTML = `\n${JSON.stringify(payload,null,4)}`;
      voiceaTranscriptionFormattedDisplay.innerHTML = transcriptTemplate({
        data: payload.captions,
      });
      voiceaTranscriptionFormattedDisplay.scrollTop = voiceaTranscriptionFormattedDisplay.scrollHeight;
    });

    meeting.on('meeting:receiveTranscription:stopped', () => {
      generalToggleTranscription.innerText = "Start Transcription";
      generalTranscriptionContent.innerHTML = 'Transcription Content: Webex Assistant must be enabled, check the console!';
    });
  }
  else {
    console.log('MeetingControls#startRecording() :: no valid meeting object!');
  }
}

function pauseRecording() {
  const meeting = getCurrentMeeting();

  if (meeting) {
    console.log('MeetingControls#pauseRecording()');
    generalControlsRecStatus.innerText = 'Pause recording...';
    meeting.pauseRecording()
      .then(() => {
        generalControlsRecStatus.innerText = 'Recording is paused!';
        console.log('MeetingControls#pauseRecording() :: meeting recording paused!');
      })
      .catch((error) => {
        generalControlsRecStatus.innerText = 'Error! See console for details.';
        console.log('MeetingControls#pauseRecording() :: unable to pause recording.');
        console.error(error);
      });
  }
  else {
    console.log('MeetingControls#pauseRecording() :: no valid meeting object!');
  }
}

function resumeRecording() {
  const meeting = getCurrentMeeting();

  if (meeting) {
    console.log('MeetingControls#resumeRecording()');
    generalControlsRecStatus.innerText = 'Resume recording...';
    meeting.resumeRecording()
      .then(() => {
        generalControlsRecStatus.innerText = 'Recording is resumed!';
        console.log('MeetingControls#resumeRecording() :: meeting recording resumed!');
      })
      .catch((error) => {
        generalControlsRecStatus.innerText = 'Error! See console for details.';
        console.log('MeetingControls#resumeRecording() :: unable to resume recording.');
        console.error(error);
      });
  }
  else {
    console.log('MeetingControls#resumeRecording() :: no valid meeting object!');
  }
}

function stopRecording() {
  const meeting = getCurrentMeeting();

  if (meeting) {
    console.log('MeetingControls#stopRecording()');
    generalControlsRecStatus.innerText = 'Stop recording meeting...';
    meeting.stopRecording()
      .then(() => {
        generalControlsRecStatus.innerText = 'Recording stopped successfully!';
        console.log('MeetingControls#stopRecording() :: meeting recording stopped!');
      })
      .catch((error) => {
        generalControlsRecStatus.innerText = 'Error! See console for details.';
        console.log('MeetingControls#stopRecording() :: unable to stop recording!');
        console.error(error);
      });
  }
  else {
    console.log('MeetingControls#stopRecording() :: no valid meeting object!');
  }
}

function sendDtmfTones() {
  const meeting = getCurrentMeeting();
  const tones = generalControlsDtmfTones.value || '';

  if (!tones) {
    console.log('MeetingControls#sendDtmfTones() :: Error, empty string.');
    generalControlsDtmfStatus.innerText = 'Please enter DTMF tones and try again.';

    return;
  }

  if (meeting) {
    console.log('MeetingControls#sendDtmfTones()');
    meeting.sendDTMF(tones)
      .then(() => {
        generalControlsDtmfStatus.innerText = 'DTMF tones sent successfully!';
        console.log('MeetingControls#sendDtmfTones() :: DTMF tones sent!');
      })
      .catch((error) => {
        generalControlsDtmfStatus.innerText = 'Error! See console for details.';
        console.log('MeetingControls#sendDtmfTones() :: unable to send DTMF tones!');
        console.error(error);
      });
  }
  else {
    console.log('MeetingControls#sendDtmfTones() :: no valid meeting object!');
  }
}

// SIP Call-Out Functions --------------------------------------------------

function validateSipCalloutFields() {
  const sipAddress = document.getElementById('gc-sip-address').value.trim();
  const displayName = document.getElementById('gc-sip-display-name').value.trim();
  const button = document.getElementById('gc-sip-callout');
  const statusElm = document.getElementById('gc-sip-callout-status');

  const shouldEnable = sipAddress && displayName;
  button.disabled = !shouldEnable;

  // Update status message
  if (statusElm) {
    if (!sipAddress || !displayName) {
      statusElm.innerText = 'Please fill in all required fields.';
      statusElm.style.color = 'orange';
    } else {
      statusElm.innerText = 'Ready to call out.';
      statusElm.style.color = 'green';
    }
  }
}


function validateCancelSipFields() {
  const participantId = document.getElementById('gc-sip-participant-id').value.trim();
  const button = document.getElementById('gc-sip-cancel-callout');
  const shouldEnable = !!participantId;
  button.disabled = !shouldEnable;
}

function clearSipCalloutFields() {
  document.getElementById('gc-sip-address').value = '';
  document.getElementById('gc-sip-display-name').value = '';
  document.getElementById('gc-sip-participant-id').value = '';
  // Reset button states
  validateSipCalloutFields();
  validateCancelSipFields();
  // Clear status messages
  document.getElementById('gc-sip-callout-status').innerText = '';
  document.getElementById('gc-sip-cancel-callout-status').innerText = '';
}

function callOutSipParticipant() {
  const meeting = getCurrentMeeting();

  if (!meeting) {
    const statusElm = document.getElementById('gc-sip-callout-status');
    statusElm.innerText = 'Error: No active meeting. Please join a meeting first.';
    statusElm.style.color = 'red';
    return;
  }
  // Get user input fields
  const sipAddress = document.getElementById('gc-sip-address').value.trim();
  const displayName = document.getElementById('gc-sip-display-name').value.trim();
  const statusElm = document.getElementById('gc-sip-callout-status');
  const button = document.getElementById('gc-sip-callout');
  button.disabled = true;
  statusElm.innerText = 'Calling out...';
  statusElm.style.color = 'blue';
  meeting.sipCallOut(sipAddress, displayName)
    .then((data) => {
      statusElm.innerText = 'SIP call-out successful!';
      statusElm.style.color = 'green';
      console.log('MeetingControls#callOutSipParticipant() :: success!', data);
      document.getElementById('gc-sip-address').value = '';
      document.getElementById('gc-sip-display-name').value = '';
      button.disabled = false;
      validateSipCalloutFields();
    })
    .catch((error) => {
      statusElm.innerText = `Error: ${error.message || 'See console'}`;
      statusElm.style.color = 'red';
      console.error('MeetingControls#callOutSipParticipant() :: error', error);
      button.disabled = false;
    });
}

function cancelSipCallOut() {
  const participantId = document.getElementById('gc-sip-participant-id').value.trim();
  const statusElm = document.getElementById('gc-sip-cancel-status');
  const button = document.getElementById('gc-sip-cancel-callout');

  if (!participantId) {
    statusElm.innerText = 'Please enter a participant ID.';
    statusElm.style.color = 'red';
    return;
  }
  button.disabled = true;
  statusElm.innerText = 'Cancelling...';
  statusElm.style.color = 'blue';
  meeting.cancelSipCallOut(
    participantId,
  )
    .then((data) => {
      statusElm.innerText = 'SIP call-out cancelled!';
      statusElm.style.color = 'green';
      console.log('MeetingControls#cancelSipCallOut() :: success!', data);
      document.getElementById('gc-sip-participant-id').value = '';
      button.disabled = false;
      validateCancelSipFields();
    })
    .catch((error) => {
      statusElm.innerText = `Error: ${error.message || 'See console'}`;
      statusElm.style.color = 'red';
      console.error('MeetingControls#cancelSipCallOut() :: error', error);
      button.disabled = false;
    });
  }
const localVideoQuality = {
  '360p': '360p',
  '480p': '480p',
  '720p': '720p',
  '1080p': '1080p'
};
const localMedia = {
  microphoneStream: undefined,
  cameraStream: undefined,
  screenShare: {
    video: undefined,
    audio: undefined,
  },
  videoConstraints: {
    [localVideoQuality["360p"]]: { width: 640, height: 360 },
    [localVideoQuality["480p"]]: { width: 640, height: 480 },
    [localVideoQuality["720p"]]: { width: 1280, height: 720 },
    [localVideoQuality["1080p"]]: { width: 1920, height: 1080 },
  }
}

function handleStreamPublishedState(meeting) {
  meeting.on('meeting:streamPublishStateChanged', ({isPublished, mediaType, stream}) => {
    let debugString, streamElm;

    switch (mediaType) {
      case 'VIDEO-MAIN':
        debugString = 'local camera';
        streamElm = meetingStreamsLocalVideo;
        break;

      case 'VIDEO-SLIDES':
        debugString = 'local share video';
        streamElm = meetingStreamsLocalShareVideo;
        break;

      case 'AUDIO-MAIN':
        debugString = 'local microphone';
        streamElm = meetingStreamsLocalAudio;
        break;

      case 'AUDIO-SLIDES':
        debugString = 'local share audio';
        streamElm = meetingStreamsLocalShareAudio;
        break;

      default:
        break;
    }

    if (!isPublished) {
      console.log(`MeetingControls#getUserMedia() :: ${debugString} stream unpublished`);
    }
  });
}

async function getUserMedia(constraints = {audio: true, video: true}) {
  const meeting = getCurrentMeeting();

  console.log('MeetingControls#getUserMedia()');

  if (!meeting) {
    console.log('MeetingControls#getUserMedia() :: no valid meeting object!');

    throw new Error('No valid meeting object.');
  }

  if (localMedia.microphoneStream) {
    console.log('MeetingControls#getUserMedia() :: microphone stream is already available');
  }
  else if (constraints.audio) {
    await loadMicrophone(constraints.audio);
  }

  if (localMedia.cameraStream) {
    console.log('MeetingControls#getUserMedia() :: camera stream is already available');
  }
  else if (constraints.video) {
    await loadCamera(constraints.video);
  }

  console.log('MeetingControls#getUserMedia() :: following local streams are ready to use:', localMedia.microphoneStream, localMedia.cameraStream);
}

async function loadCamera(constraints) {
  try {
    console.log('MeetingControls#loadCamera() :: using webrtc-core local camera stream');
    const videoConstraints = {...localMedia.videoConstraints[localVideoQuality[localResolutionInp.value]], ...constraints};

    console.log('MeetingControls#loadCamera() :: getting camera stream with constraints: ', videoConstraints);
    localMedia.cameraStream = await webex.meetings.mediaHelpers.createCameraStream(videoConstraints);

    meetingStreamsLocalVideo.srcObject = localMedia.cameraStream.outputStream;

    localMedia.cameraStream.on('user-mute-state-change', (muted) => {
      console.log('MeetingControls#loadCamera() :: local camera stream user mute state changed to', muted);
    });

    localMedia.cameraStream.on('system-mute-state-change', (muted) => {
      console.log('MeetingControls#loadCamera() :: local camera stream system mute state changed to', muted);
      handleMuteVideoMessage();
    });

    localMedia.cameraStream.on('stream-ended', () => {
      console.log('MeetingControls#loadCamera() :: local camera stream ended');

      localMedia.cameraStream = undefined;
      meetingStreamsLocalVideo.srcObject = null;
      stopVideoButton.disabled = true;
      stopVideoButton.innerText = 'Start Video';
      loadCameraBtn.disabled = false;
      modeBtn.disabled = false;
      clearVideoResolutionCheckInterval(localVideoResElm, localVideoResolutionInterval);
    });

    handleMuteVideoMessage();
    handleVbgButton();
    loadCameraBtn.disabled = true;
    stopVideoButton.disabled = false;
    console.log('MeetingControls#loadCamera() :: Successfully got camera stream:', localMedia.cameraStream);
  }
  catch (e) {
    console.log('MeetingControls#loadCamera() :: Error getting camera stream!');
    throw e;
  }
}

async function handleVbg() {
  let effect;
  try {
    effect = await localMedia.cameraStream.getEffectByKind('virtual-background-effect');

    if (!effect?.isEnabled) {
      console.log('MeetingControls#handleVbg() :: applying virtual background to local camera stream');

      if (!effect) {
        effect = await webex.meetings.createVirtualBackgroundEffect({
          "mode": modeBtn.value,
          "bgImageUrl": blurVBGImageUrl,
          "bgVideoUrl": blurVBGVideoUrl,
          env: integrationEnv.checked ? 'int' : 'prod',
          preventBackgroundThrottling: true,
        });
        handleVbgButton(effect);
        await localMedia.cameraStream.addEffect(effect);
      }

      await effect.enable();
      modeBtn.disabled = true;

      handleVbgButton(effect);
      console.log('MeetingControls#handleVbg() :: successfully applied virtual background to local camera stream');
    }
    else {
      console.log('MeetingControls#handleVbg() :: disabling virtual background from local camera stream');

      await effect.disable();
      handleVbgButton(effect);
      console.log('MeetingControls#handleVbg() :: successfully disabled virtual background from local camera stream');
    }
  }
  catch (e) {
    console.log('MeetingControls#handleVbg() :: Error applying background effect!');
    handleVbgButton(effect);
    throw e;
  }
}

async function loadMicrophone(constraints) {
  try {
    console.log('MeetingControls#loadMicrophone() :: using webrtc-core local microphone stream');
    const audioConstraints = {...constraints};

    console.log('MeetingControls#loadMicrophone() :: getting microphone stream with constraints: ', audioConstraints);
    localMedia.microphoneStream = await webex.meetings.mediaHelpers.createMicrophoneStream(audioConstraints);

    meetingStreamsLocalAudio.srcObject = localMedia.microphoneStream.outputStream;

    localMedia.microphoneStream.on('user-mute-state-change', (muted) => {
      console.log('MeetingControls#loadMicrophone() :: local microphone stream user mute state changed to', muted);
      handleAudioButton();
    });

    localMedia.microphoneStream.on('system-mute-state-change', (muted) => {
      console.log('MeetingControls#loadMicrophone() :: local microphone stream system mute state changed to', muted);
      handleMuteAudioMessage();
    });

    localMedia.microphoneStream.on('stream-ended', () => {
      console.log('MeetingControls#loadMicrophone() :: local microphone stream ended');

      localMedia.microphoneStream = undefined;
      meetingStreamsLocalAudio.srcObject = null;
      stopAudioButton.disabled = true;
      stopAudioButton.innerText = 'Start Audio';
      loadMicrophoneBtn.disabled = false;
    });

    handleMuteAudioMessage();
    updateNoiseReductionButton();
    loadMicrophoneBtn.disabled = true;
    stopAudioButton.disabled = false;
    console.log('MeetingControls#loadMicrophone() :: Successfully got microphone stream:', localMedia.microphoneStream);
  }
  catch (e) {
    console.log('MeetingControls#loadMicrophone() :: Error getting microphone stream!');
    throw e;
  }
}

async function handleNoiseReduction() {
  let effect;
  const modelSelect = document.getElementById('ts-model-select');
  const selectedModel = modelSelect ? modelSelect.value : 'bnr';

  try {
    effect = await localMedia.microphoneStream.getEffectByKind('noise-reduction-effect');
    if (!effect?.isEnabled) {
      console.log(`MeetingControls#handleNoiseReduction() :: applying noise reduction (${selectedModel}) to local microphone stream`);

      if (!effect) {
        effect = await webex.meetings.createNoiseReductionEffect({
          env: integrationEnv.checked ? 'int' : 'prod',
          model: selectedModel
        });
        await localMedia.microphoneStream.addEffect(effect);
        // Lock model selection once effect is created (cannot change model after this)
        lockModelSelect(effect.model);
      }

      await effect.enable();
      updateNoiseReductionButton(effect);
      console.log(`MeetingControls#handleNoiseReduction() :: successfully applied noise reduction (${effect.model}) to local microphone stream`);

    }
    else {
      console.log('MeetingControls#handleNoiseReduction() :: disabling noise reduction from local microphone stream');

      await effect.disable();
      updateNoiseReductionButton(effect);
      console.log('MeetingControls#handleNoiseReduction() :: successfully disabled noise reduction from local microphone stream');
    }
  }
  catch (e) {
    console.log('MeetingControls#handleNoiseReduction() :: Error applying noise reduction effect');
    updateNoiseReductionButton(effect);
    throw e;
  }
}

function handleModelChange() {
  const modelSelect = document.getElementById('ts-model-select');
  const selectedModel = modelSelect ? modelSelect.value : 'bnr';

  const effect = localMedia?.microphoneStream?.getEffectByKind?.('noise-reduction-effect');
  if (effect) {
    console.log('MeetingControls#handleModelChange() :: effect already exists, model cannot be changed');
    modelSelect.value = effect.model || 'bnr';
    return;
  }

  updateNoiseReductionButton();

  console.log(`MeetingControls#handleModelChange() :: selected model ${selectedModel} (will be applied on enable)`);
}

function lockModelSelect(effectModel) {
  const modelSelect = document.getElementById('ts-model-select');
  const lockedMessage = document.getElementById('ts-model-locked');

  if (modelSelect) {
    modelSelect.disabled = true;
    modelSelect.title = 'Model cannot be changed after effect is created. Reload page to change model.';

    if (effectModel && modelSelect.value !== effectModel) {
      modelSelect.value = effectModel;
    }
  }

  if (lockedMessage) {
    lockedMessage.style.display = 'block';
  }
}

function handleVbgButton(effect) {
  let disabled = false;
  let title;

  if (!effect) {
    title = 'Enable VBG';
  } else if (!effect.isLoaded) {
    disabled = true;
    title = 'Applying Effect...';
  } else if (effect.isEnabled) {
    title = 'Disable VBG';
  } else {
    title = 'Enable VBG';
  }

  toggleVbgBtn.disabled = disabled;
  toggleVbgBtn.innerText = title;
}

function updateNoiseReductionButton(effect) {
  let disabled = false;
  let title;

  // Get model name from effect or dropdown
  let modelName;
  if (effect?.model) {
    modelName = effect.model;
  } else {
    const modelSelect = document.getElementById('ts-model-select');
    modelName = modelSelect?.value || 'bnr';
  }
  const displayName = modelName.toUpperCase();

  if (!effect) {
    title = `Enable ${displayName}`;
  } else if (!effect.isLoaded) {
    disabled = true;
    title = 'Applying Effect...';
  } else if (effect.isEnabled) {
    title = `Disable ${displayName}`;
  } else {
    title = `Enable ${displayName}`;
  }

  noiseReductionBtn.disabled = disabled;
  noiseReductionBtn.innerText = title;
}

async function stopStartVideo() {
  if(stopVideoButton.innerText === 'Stop Video') {
    console.log('MeetingControls#stopVideo()');
    try {
      if (localMedia.cameraStream) {
        localMedia.cameraStream.stop();
      }

      console.log('MeetingControls#stopStartVideo() :: Successfully stopped video!');
    }
    catch (error) {
      console.log('MeetingControls#stopStartVideo() :: Error stopping video!');
      console.error(error);
    }
  }
  else{
    const meeting = getCurrentMeeting();
    const {cameraStream} = localMedia;

    if (!cameraStream) {
      console.log('MeetingControls#stopStartVideo() :: video stream not available!');

      throw new Error('Video stream not available');
    }

    try {
      console.log('MeetingControls#stopStartVideo() :: publishing video stream');
      await meeting.publishStreams({
        camera: cameraStream
      });

      console.log('MeetingControls#stopStartVideo() :: Successfully started video!');
      stopVideoButton.innerText = 'Stop Video';
    }
    catch (error) {
      console.log('MeetingControls#stopStartVideo() :: Error starting video in meeting!');
      console.error(error);
    }
  }

}

async function stopStartAudio() {
  if(stopAudioButton.innerText === 'Stop Audio') {
    console.log('MeetingControls#stopStartAudio()');
    try {
      if (localMedia.microphoneStream) {
        localMedia.microphoneStream.stop();
      }

      console.log('MeetingControls#stopStartAudio() :: Successfully stopped audio!');
    }
    catch (error) {
      console.log('MeetingControls#stopStartAudio() :: Error stopping audio!');
      console.error(error);
    }
  }
  else{
    const meeting = getCurrentMeeting();
    const {microphoneStream} = localMedia;

    if (!microphoneStream) {
      console.log('MeetingControls#stopStartAudio() :: audio stream not available!');

      throw new Error('Audio stream not available');
    }

    try {
      console.log('MeetingControls#stopStartAudio() :: publishing audio stream');
      await meeting.publishStreams({
        microphone: microphoneStream
      });

      console.log('MeetingControls#stopStartAudio() :: Successfully started audio!');
      stopAudioButton.innerText = 'Stop Audio';
    }
    catch (error) {
      console.log('MeetingControls#stopStartAudio() :: Error starting audio in meeting!');
      console.error(error);
    }
  }

}

function populateSourceDevices(mediaDevice) {
  let select = null;
  const option = document.createElement('option');

  // eslint-disable-next-line default-case
  switch (mediaDevice.kind) {
    case 'audioinput':
      select = sourceDevicesAudioInput;
      break;
    case 'audiooutput':
      select = sourceDevicesAudioOutput;
      break;
    case 'videoinput':
      select = sourceDevicesVideoInput;
      break;
  }
  option.value = mediaDevice.deviceId;
  option.text = mediaDevice.label;
  select.appendChild(option);
}

function getMediaDevices() {
  const meeting = getCurrentMeeting();

  if (meeting) {
    console.log('MeetingControls#getMediaDevices()');
    webex.meetings.mediaHelpers.getDevices()
      .then((devices) => {
        devices.forEach((device) => {
          populateSourceDevices(device);
        });
      });
  }
  else {
    console.log('MeetingControls#getMediaDevices() :: no valid meeting object!');
  }
}

async function updateMedia() {
  const meeting = getCurrentMeeting();
  const changedMediaSettings = getMediaSettings(true);

  if (!meeting) {
    console.log('MeetingStreams#updateMedia() :: no valid meeting object!');
  }

  console.log(`MeetingStreams#updateMedia() :: calling updateMedia(${JSON.stringify(changedMediaSettings)}`);
  return meeting.updateMedia(changedMediaSettings)
    .then(() => {
      currentMediaSettings = getMediaSettings();
    })
    .catch((error) => {
      revertMediaSettings(changedMediaSettings);
      console.error(error);
    })
}

const getOptionValue = (select) => {
  const selected = select.options[select.options.selectedIndex];

  return selected ? selected.value : undefined;
};

const getRadioValue = (name) => {
  let selected = null;

  document.querySelectorAll(`[name="${name}"]`).forEach((item) => {
    if (item.checked) {
      selected = item;
    }
  });

  return selected ? selected.value : undefined;
};

function getAudioVideoInput() {
  const deviceId = (id) => {
    if (id === 'default')
      return {deviceId: id};
    else
      return {deviceId: {exact: id}};
  };
  const audioInput = getOptionValue(sourceDevicesAudioInput) || 'default';
  const videoInput = getOptionValue(sourceDevicesVideoInput) || 'default';

  return {audio: deviceId(audioInput), video: deviceId(videoInput)};
}

function setVideoInputDevice() {
  const meeting = getCurrentMeeting();
  const {video} = getAudioVideoInput();

  if (meeting) {
    const isMuted = localMedia.cameraStream?.userMuted;
    localMedia.cameraStream?.stop();

    return getUserMedia({video})
      .then(() => {
        localMedia.cameraStream.setUserMuted(!!isMuted);
        localVideoResolutionCheckInterval();
        meeting.publishStreams({camera: localMedia.cameraStream});
      });
  }
  else {
    console.log('MeetingControls#setVideoInputDevice() :: no valid meeting object!');
  }
}

function setAudioInputDevice() {
  const meeting = getCurrentMeeting();
  const {audio} = getAudioVideoInput();

  if (meeting) {
    const isMuted = localMedia.microphoneStream?.userMuted;
    localMedia.microphoneStream?.stop();

    return getUserMedia({audio})
      .then(() => {
        localMedia.microphoneStream.setUserMuted(!!isMuted);
        meeting.publishStreams({microphone: localMedia.microphoneStream});
      });
  }
  else {
    console.log('MeetingControls#setAudioInputDevice() :: no valid meeting object!');
  }
}

function setAudioOutputDevice() {
  const audioOutputDevice = getOptionValue(sourceDevicesAudioOutput) || 'default';

  meetingStreamsRemoteAudio.setSinkId(audioOutputDevice)
    .then(() => {
      console.log(`MeetingControls#setAudioOutput() :: successfully set audio output to: ${audioOutputDevice}`);
    })
    .catch((error) => {
      console.log('MeetingControls#setAudioOutput() :: Error setting audio output!');
      console.error(error);
    });
}

function handleAudioButton() {
  const audioButtonTitle = localMedia.microphoneStream.userMuted ? 'Unmute' : 'Mute';
  toggleAudioButton.innerHTML = `${audioButtonTitle} Audio`;
}

function handleMuteAudioMessage() {
  muteAudioMessage.innerHTML = localMedia.microphoneStream.systemMuted ? "Warning: microphone may be muted by the system" : "";
}

function handleBrbShareMessage(showMessage) {
  brbShareMessage.hidden = !showMessage;
  defaultShareMessage.hidden = showMessage;
}

function toggleSendAudio() {
  console.log('MeetingControls#toggleSendAudio()');

  if (localMedia.microphoneStream) {
    const newMuteValue = !localMedia.microphoneStream.userMuted;

    localMedia.microphoneStream.setUserMuted(newMuteValue);

    console.log(`MeetingControls#toggleSendAudio() :: Successfully ${newMuteValue ? 'muted': 'unmuted'} audio!`);

    if (isBrb) {
      toggleBrb({unmuteAudio: true});
    }
  }
}

function handleMuteVideoMessage() {
  muteVideoMessage.innerHTML = localMedia.cameraStream.systemMuted ? "Warning: camera may be muted by the system" : "";
}

function toggleSendVideo() {
  console.log('MeetingControls#toggleSendVideo()');

  if (localMedia.cameraStream) {
    const newMuteValue = !localMedia.cameraStream.userMuted;

    localMedia.cameraStream.setUserMuted(newMuteValue);

    console.log(`MeetingControls#toggleSendVideo() :: Successfully ${newMuteValue ? 'muted': 'unmuted'} video!`);

    if (isBrb) {
      toggleBrb({unmuteVideo: true});
    }
  }
}

async function startScreenShare() {
  // Using async/await to make code more readable
  console.log('MeetingControls#startScreenShare()');
  try {
    //TODO: Add audio share toggle in sample app
    const [localShareVideoStream, localShareAudioStream] = await webex.meetings.mediaHelpers.createDisplayStreamWithAudio();

    localMedia.screenShare.video = localShareVideoStream;

    localMedia.screenShare.video.on('stream-ended', () => {
      console.log('MeetingControls#startScreenShare() :: local share video stream ended');

      localMedia.screenShare.video = undefined;
      meetingStreamsLocalShareVideo.srcObject = null;
      stopShareBtn.disabled = true;
    });

    localMedia.screenShare.audio = localShareAudioStream;

    localMedia.screenShare.audio?.on('stream-ended', () => {
      console.log('MeetingControls#startScreenShare() :: local share audio stream ended');

      localMedia.screenShare.audio = undefined;
      meetingStreamsLocalShareAudio.srcObject = null;
    });

    meetingStreamsLocalShareVideo.srcObject = localShareVideoStream.outputStream;
    meetingStreamsLocalShareAudio.srcObject = localShareAudioStream?.outputStream;
    stopShareBtn.disabled = false;

  }
  catch (error) {
    console.log('MeetingControls#startScreenShare() :: Error starting screen share!');
    console.error(error);
  }
}

async function publishScreenShare() {
  const meeting = getCurrentMeeting();
  const {screenShare} = localMedia;

  if (!screenShare || !screenShare.video) {
    console.log('MeetingControls#publishScreenShare() :: screen share stream not available!');

    throw new Error('screen share stream not available');
  }

  try {
    console.log('MeetingControls#publishScreenShare() :: publishing share stream');
    await meeting.publishStreams({
      screenShare: {
        video: localMedia.screenShare.video,
        audio: localMedia.screenShare.audio,
      }
    });

    console.log('MeetingControls#publishScreenShare() :: Successfully started sharing in meeting!');
  }
  catch (error) {
    console.log('MeetingControls#publishScreenShare() :: Error starting screen share in meeting!');
    console.error(error);
  }
}

async function unpublishScreenShare() {
  const meeting = getCurrentMeeting();

  console.log('MeetingControls#unpublishScreenShare()');
  try {
    const streamsToUnpublish = [];

    if (localMedia.screenShare.audio) {
      streamsToUnpublish.push(localMedia.screenShare.audio);
    }
    if (localMedia.screenShare.video) {
      streamsToUnpublish.push(localMedia.screenShare.video);
    }

    if (streamsToUnpublish.length) {
      await meeting.unpublishStreams(streamsToUnpublish);
    }

    console.log('MeetingControls#unpublishScreenShare() :: unpublished share stream!');
  }
  catch (error) {
    console.log('MeetingControls#unpublishScreenShare() :: Error unpublishing share stream!');
    console.error(error);
  }
}

function setLocalMeetingQuality() {
  const audioVideoInputDevices = getAudioVideoInput();

  const videoConstraints = {...localMedia.videoConstraints[localVideoQuality[localResolutionInp.value]], ...audioVideoInputDevices.video};

  console.log('MeetingControls#setLocalMeetingQuality() :: applying new constraints to camera stream: ', videoConstraints);
  return localMedia.cameraStream?.applyConstraints(videoConstraints);

}

function setRemoteMeetingQuality() {
  const meeting = getCurrentMeeting();
  const level = remoteResolutionInp.value;

  meeting.setRemoteQualityLevel(level)
    .then(() => {
      toggleSourcesQualityStatus.innerText = `Remote meeting quality level set to ${level}!`;
      console.log('MeetingControls#setRemoteMeetingQuality :: Meeting quality level set successfully!');

      getRemoteMediaSettings();
    })
    .catch((error) => {
      toggleSourcesQualityStatus.innerText = 'MeetingControls#setRemoteMeetingQuality :: Error setting quality level!';
      console.log('MeetingControls#setRemoteMeetingQuality :: Error meeting quality!');
      console.error(error);
    });
}

function clearMediaDeviceList() {
  sourceDevicesAudioInput.innerText = '';
  sourceDevicesAudioOutput.innerText = '';
  sourceDevicesVideoInput.innerText = '';
}

function getLocalMediaSettings() {
  if (localMedia.cameraStream) {
    const videoSettings = localMedia.cameraStream.getSettings();
    const {frameRate, height} = videoSettings;
    localVideoResElm.innerText = `${height}p ${Math.round(frameRate)}fps`;
  }
}

function getRemoteMediaSettings() {
  const meeting = getCurrentMeeting();

  if (meeting && meeting.mediaProperties.remoteVideoStream) {
    const videoSettings = meeting.mediaProperties.remoteVideoStream.getSettings();
    const {frameRate, height} = videoSettings;
    remoteVideoResElm.innerText = `${height}p ${Math.round(frameRate)}fps`;
  }
}

let localVideoResolutionInterval;
let remoteVideoResolutionInterval;
const INTERVAL_TIME = 3000;

function localVideoResolutionCheckInterval() {
  if (localVideoResolutionInterval) {
    clearInterval(localVideoResolutionInterval);
  }

  localVideoResolutionInterval = setInterval(() => {
    getLocalMediaSettings();
  }, INTERVAL_TIME);
}

function remoteVideoResolutionCheckInterval() {
  if (remoteVideoResolutionInterval) {
    clearInterval(remoteVideoResolutionInterval);
  }

  remoteVideoResolutionInterval = setInterval(() => {
    getRemoteMediaSettings();
  }, INTERVAL_TIME);
}

function clearVideoResolutionCheckInterval(element, intervalId) {
  element.innerText = '';
  clearInterval(intervalId);
  if (element.id === "local-video-resolution") {
    localVideoResolutionInterval = null;
  }
  else {
    remoteVideoResolutionInterval = null;
  }
}

// Meeting Streams --------------------------------------------------
const remoteSourcesCount = {
  audio: {
    total: 0,
    live: 0,
  },
  video: {
    total: 0,
    live: 0,
  }
};

const stageElements = {
  wrapper: undefined,
  select: undefined,
  options: undefined,
};

const currentVideoPaneList = [];

// these stage related constants have to match the layout configuration (see Stage2x2With6ThumbnailsLayout)
const STAGE_SIZE = 4;

const multistreamStage = {
  lastAddedIndex: -1,
  stagedMemberIds: Array(STAGE_SIZE).fill(undefined)
};

function updateRemoteSourcesInfo() {
  document.getElementById('remote-sources-info').innerText =
    `Remote live sources: audio=${remoteSourcesCount.audio.live}/${remoteSourcesCount.audio.total} video=${remoteSourcesCount.video.live}/${remoteSourcesCount.video.total}`;
}

let allVideoPanes = {}; // a map of video pane groups, each group is just an array of panes

function updateVideoPanesForActiveSpeaker() {
  Object.values(allVideoPanes).forEach((paneGroup) =>
    Object.values(paneGroup).forEach((videoPane) => {
      if (videoPane.memberId && currentActiveSpeakersMemberIds.includes(videoPane.memberId)) {
        videoPane.nameLabelEl.classList.add('speaking');
      }
      else {
        videoPane.nameLabelEl.classList.remove('speaking');
      }
    }));
}

function clearAllMultistreamVideoElements() {
  const parentContainer = document.getElementById('multistream-videos-container');

  while (parentContainer.firstChild) {
    parentContainer.removeChild(parentContainer.lastChild);
  }

  allVideoPanes = {};
}

function addElement(parent, tag, props = {}) {
  const element = document.createElement(tag);

  Object.keys(props).forEach((key) => {
    element[key] = props[key];
  });

  if (parent) {
    parent.appendChild(element);
  }

  return element;
}
function addVideoPane(parent, className) {
  const containerEl = addElement(null, 'div', {className: `video-container hidden ${className}`});
  const videoEl = addElement(containerEl, 'video', {className: 'multistream-remote-video', autoplay: true, playsInline: true});
  const nameLabelEl = addElement(containerEl, 'div', {className: 'video-label', innerText: ''});

  const overlayEl = addElement(containerEl, 'div', {className: 'video-overlay hidden'});
  const overlayTextEl = addElement(overlayEl, 'p', {className: 'video-overlay-text', innerText: ''});

  parent.appendChild(containerEl);

  const videoPane = {
    containerEl,
    videoEl,
    nameLabelEl,
    memberId: undefined,
    overlayEl,
    overlayTextEl,
    remoteMedia: null,
    debugText: '',
    isActive: false,
    onclick: null,
    onCtrlClick: null,
  };

  containerEl.onclick = (event) => {
    if (event.ctrlKey) {
      videoPane.onCtrlClick(event);
    }
    else {
      videoPane.onclick(event);
    }
  };

  return videoPane;
}

function createSingleVideo() {
  const container = document.getElementById('multistream-videos-container');

  allVideoPanes.main = [addVideoPane(container, 'big-video')];
}

function createContainer(parent, id) {
  return addElement(
    (parent) || document.getElementById('multistream-videos-container'),
    'div',
    {className: 'video-grid-row', id}
  );
}

function createOnePlusFiveVideos() {
  allVideoPanes.mainBigOne = [];
  allVideoPanes.secondarySetOfSmallPanes = [];

  // create the big one
  const firstRowEl = createContainer();

  allVideoPanes.mainBigOne.push(addVideoPane(firstRowEl, 'big-video'));

  // create 5 small ones
  const secondRowEl = createContainer();

  for (let i = 0; i < 5; i += 1) {
    allVideoPanes.secondarySetOfSmallPanes.push(addVideoPane(secondRowEl, 'small-video'));
  }
}

function createStageVideoPane(stageContainer, paneId, remoteMedia) {
  const videoPane = addVideoPane(stageContainer, 'grid-video clickable');

  videoPane.onclick = () => {
    const meeting = getCurrentMeeting();

    if (videoPane.isActive) {
      console.log(`removing from stage ${videoPane.remoteMedia.id}`);
      meeting.remoteMediaManager.removeMemberVideoPane(paneId);
      updateVideoPane(videoPane, meeting, 'no source', undefined, `stage.${paneId} ${videoPane.remoteMedia.id}`, 'removed from stage');
      delete allVideoPanes.stage[paneId];
    }

    updateVideoPaneTooltip(videoPane, meeting);
  };

  allVideoPanes.stage[paneId] = videoPane;
  if (remoteMedia) {
    allVideoPanes.stage[paneId].remoteMedia = remoteMedia;
  }
}
function createStageLayoutVideos() {
  allVideoPanes.thumbnails = [];
  allVideoPanes.stage = {};

  // create the stage - a 2x2 grid
  const stageFieldset = addElement(null, 'fieldset', {className: 'stage'});
  const legendEl = addElement(stageFieldset, 'legend', {innerText: `Stage (for maximum of ${STAGE_SIZE} participants)`});
  const stageContainer = createContainer(stageFieldset, 'stageContainer');

  createStageVideoPane(stageContainer, 'stage-1');
  createStageVideoPane(stageContainer, 'stage-2');
  createStageVideoPane(stageContainer, 'stage-3');
  createStageVideoPane(stageContainer, 'stage-4');

  document.getElementById('multistream-videos-container').appendChild(stageFieldset);

  // create 6 small ones
  const thumbnailsFieldset = addElement(null, 'fieldset', {className: 'stageThumbnails'});
  const thumbnailsLegendEl = addElement(thumbnailsFieldset, 'legend', {innerText: 'Active speakers'});

  const thumbnailsContainer = createContainer(thumbnailsFieldset);

  for (let i = 0; i < 6; i += 1) {
    allVideoPanes.thumbnails.push(addVideoPane(thumbnailsContainer, 'small-video'));
  }

  document.getElementById('multistream-videos-container').appendChild(thumbnailsFieldset);
}

function createScreenshareView() {
  allVideoPanes.screenShare = [];
  allVideoPanes.thumbnails = [];

  // create the thumbnails
  // numOfThumbnails needs to be equal to DefaultConfiguration.video.layouts.ScreenShareView.activeSpeakerVideoPaneGroups[0].numPanes,
  // but we can't import it, so using a hardcoded value
  const numOfThumbnails = 8;
  const thumbnailsContainer = createContainer();

  for (let i = 0; i < numOfThumbnails; i += 1) {
    allVideoPanes.thumbnails.push(addVideoPane(thumbnailsContainer, 'small-video'));
  }

  // create the pane for the screen share
  const screenshareContainer = createContainer();

  allVideoPanes.screenShare.push(addVideoPane(screenshareContainer, 'big-video'));
}

function setGridVideoPaneMaxWidth(numOfActiveVideoPanes) {
  let maxWidth = '0px';

  if (numOfActiveVideoPanes === 0) {
    maxWidth = '0px';
  }
  else if (numOfActiveVideoPanes === 1) {
    maxWidth = '100%';
  }
  else if (numOfActiveVideoPanes <= 4) {
    maxWidth = '47%'; // we want 50% but because of the gaps between the panes, we have to use a bit less
  }
  else if (numOfActiveVideoPanes <= 9) {
    maxWidth = '30%'; // we want 33% but because of the gaps between the panes, we have to use a bit less
  }
  else if (numOfActiveVideoPanes <= 16) {
    maxWidth = '23%'; // we want 25% but because of the gaps between the panes, we have to use a bit less
  }
  else {
    maxWidth = '18%'; // we want 20% but because of the gaps between the panes, we have to use a bit less
  }

  document.documentElement.style.setProperty('--video-grid-max-width', maxWidth);
}
function createVideoGrid(rows, columns) {
  allVideoPanes.main = [];

  setGridVideoPaneMaxWidth(0); // 0, because at the start we don't know how many active video panes we will have

  const gridContainer = createContainer();

  for (let idx = 0; idx < columns * rows; idx += 1) {
    const videoPane = addVideoPane(gridContainer, 'grid-video clickable');

    videoPane.onclick = () => {
      const meeting = getCurrentMeeting();

      if (meeting.remoteMediaManager.isPinned(videoPane.remoteMedia)) {
        console.log(`unpinning remoteMedia ${videoPane.remoteMedia.id}`);
        meeting.remoteMediaManager.unpinActiveSpeakerVideoPane(videoPane.remoteMedia);
      }
      else {
        console.log(`pinning remoteMedia ${videoPane.remoteMedia.id} to CSI=${videoPane.remoteMedia.csi}`);
        meeting.remoteMediaManager.pinActiveSpeakerVideoPane(videoPane.remoteMedia);
      }
      updateVideoPaneTooltip(videoPane, meeting);
    };
    allVideoPanes.main.push(videoPane);
  }
}

function createVideoElementsForLayout(layoutId) {
  switch (layoutId) {
    case 'AllEqual':
      createVideoGrid(3, 3);
      break;

    case 'AllEqual25':
      createVideoGrid(5, 5);
      break;

    case 'OnePlusFive':
      createOnePlusFiveVideos();
      break;

    case 'Single':
      createSingleVideo();
      break;

    case 'Stage':
      createStageLayoutVideos();
      break;

    case 'ScreenShareView':
      createScreenshareView();
      break;

    default:
      console.error(`unexpected layoutId ${layoutId}`);
      break;
  }
}

function getDisplayNameForMemberId(meeting, memberId) {
  if (memberId) {
    return meeting.members.membersCollection.get(memberId).name;
  }

  return '';
}

function updateVideoPaneTooltip(videoPane, meeting) {
  let titleText = videoPane.debugText;

  // we only allow pinning on the grid layouts (AllEqual and AllEqual25)
  const currentLayoutId = meeting.remoteMediaManager?.getLayoutId();
  if (currentLayoutId === 'AllEqual' || currentLayoutId === 'AllEqual25') {
    const isPinned = meeting.remoteMediaManager.isPinned(videoPane.remoteMedia);

    titleText = `Click to ${isPinned ? 'un' : ''}pin this pane (${videoPane.debugText})`;
  }

  if (meeting.remoteMediaManager?.getLayoutId() === 'Stage') {
    // if it's one of the stage video panes
    if (Object.values(allVideoPanes.stage).includes(videoPane)) {
      titleText = `Click to remove this pane from the stage (${videoPane.debugText})`;
    }
  }

  videoPane.containerEl.setAttribute('title', titleText);
}

/**
 * Returns true if currently selected layout contains an "all equal" grid
 */
function updateVideoGridPaneSizes() {
  const currentLayoutId = multistreamLayoutElm.value;

  if (currentLayoutId === 'AllEqual' || currentLayoutId === 'AllEqual25') {
    const numOfActiveVideoPanes = allVideoPanes.main.filter((pane) => pane.isActive).length;

    setGridVideoPaneMaxWidth(numOfActiveVideoPanes);
  }
  if (currentLayoutId === 'Stage') {
    const numOfActiveVideoPanes = Object.values(allVideoPanes.stage).filter((pane) => pane.isActive).length;

    setGridVideoPaneMaxWidth(numOfActiveVideoPanes);
  }
}
function updateVideoPane(videoPane, meeting, sourceState, memberId, title, debugString) {
  // eslint-disable-next-line no-param-reassign
  videoPane.debugText = title;
  videoPane.sourceState = sourceState;

  if (sourceState === 'no source') {
    // eslint-disable-next-line no-param-reassign
    videoPane.isActive = false;
    videoPane.containerEl.classList.add('hidden');
    videoPane.containerEl.setAttribute('title', '');
    // eslint-disable-next-line no-param-reassign
    videoPane.nameLabelEl.innerText = '';
    videoPane.nameLabelEl.classList.remove('speaking');
    // eslint-disable-next-line no-param-reassign
    videoPane.memberId = undefined;
    console.log(`MeetingStreams#updateVideoPane() :: ${debugString} ${sourceState} ${title}`);
  }
  else {
    // eslint-disable-next-line no-param-reassign
    videoPane.isActive = true;

    const newName = getDisplayNameForMemberId(meeting, memberId);

    updateVideoPaneTooltip(videoPane, meeting);

    videoPane.containerEl.classList.remove('hidden');
    // eslint-disable-next-line no-param-reassign
    videoPane.nameLabelEl.innerText = newName;
    if (memberId && currentActiveSpeakersMemberIds.includes(memberId)) {
      videoPane.nameLabelEl.classList.add('speaking');
    }
    // eslint-disable-next-line no-param-reassign
    videoPane.memberId = memberId;

    if (sourceState === 'live') {
      // eslint-disable-next-line no-param-reassign
      videoPane.overlayTextEl.innerText = '';
      videoPane.overlayEl.classList.add('hidden');
    }
    else {
      // eslint-disable-next-line no-param-reassign
      videoPane.overlayTextEl.innerText = sourceState;
      videoPane.overlayEl.classList.remove('hidden');
    }

    console.log(`MeetingStreams#updateVideoPane() :: ${debugString} ${sourceState} "${newName}" ${title} `);
  }

  updateVideoGridPaneSizes();
}

function resetMultistreamStage(meeting) {
  for (let i = 0; i < multistreamStage.stagedMemberIds.length; i += 1) {
    multistreamStage.stagedMemberIds[i] = undefined;
  }
  multistreamStage.lastAddedIndex = -1;
}

async function addToStage() {
  const meeting = getCurrentMeeting();
  const memberId = document.getElementById('multistream-stage-selector').value;

  const csi = meeting.members.getCsisForMember(memberId, 'video', 'main')[0];

  if (csi) {
    // find the index for the next stage video pane that we want to use
    const index = (multistreamStage.lastAddedIndex + 1);

    const stagePaneId = `stage-${index + 1}`; // this has to match the pane ids from Stage2x2With6ThumbnailsLayout

    if (index < multistreamStage.stagedMemberIds.length) {
      // video pane already exists, we just need to update the CSI for it
      console.log(`adding to stage at index ${index}: ${memberId} csi=${csi}`);

      const {remoteMedia} = allVideoPanes.stage[stagePaneId];

      meeting.remoteMediaManager.setRemoteVideoCsi(remoteMedia, csi);
    }
    else {
      // we need to add a new member video pane to the current layout
      console.log(`adding to stage at index ${index}: ${memberId} csi=${csi} (new video pane)`);

      const remoteMedia = await meeting.remoteMediaManager.addMemberVideoPane({id: stagePaneId, size: 'medium', csi});

      createStageVideoPane(document.getElementById('stageContainer'), stagePaneId, remoteMedia);

      processNewVideoPane(meeting, 'stage', stagePaneId, remoteMedia);
    }

    multistreamStage.stagedMemberIds[index] = memberId;
    multistreamStage.lastAddedIndex = index;
  }
  else {
    console.warn('selected person is not sending any main video, so cannot be added to the stage');
  }
}

function populateStageSelector() {
  const meeting = getCurrentMeeting();

  const selectEl = document.getElementById('multistream-stage-selector');

  // clear out all the options
  while (selectEl.firstChild) {
    selectEl.removeChild(selectEl.lastChild);
  }

  // create new options - 1 for each member
  const members = meeting.members.membersCollection.getAll();

  Object.entries(members).forEach(([key, member]) => {
    if (member.status !== 'NOT_IN_MEETING') {
      addElement(selectEl, 'option', {value: member.id, innerText: member.name});
    }
  });

  selectEl.selectedIndex = 0;
}

function showStageSelector() {
  document.getElementById('stage-selector-wrapper').classList.remove('hidden');
}

function hideStageSelector() {
  document.getElementById('stage-selector-wrapper').classList.add('hidden');
}

function updateMultistreamVideoLayout() {
  const meeting = getCurrentMeeting();

  if (!meeting) {
    return;
  }
  if (!meeting.mediaProperties.webrtcMediaConnection) {
    return;
  }

  const oldLayoutId = meeting.remoteMediaManager?.getLayoutId();
  const newLayoutId = multistreamLayoutElm.value;

  if (newLayoutId === oldLayoutId) {
    return;
  }

  console.log(`MeetingStreams#updateMultistreamVideoLayout() :: changing layout from ${oldLayoutId} to ${newLayoutId}`);

  if (newLayoutId === 'Stage') {
    showStageSelector();
  }
  else if (oldLayoutId === 'Stage') {
    hideStageSelector();

    // we also undo all of the staging of members when we switch to a non-staged layout
    resetMultistreamStage(meeting);
  }

  if (meeting.remoteMediaManager) {
    meeting.remoteMediaManager.setLayout(newLayoutId);
  }
}

function setPreferLiveVideo () {
  let preferLiveVideo = false;
  const meeting = getCurrentMeeting();

  if (!meeting) {
    return;
  }
  if (!meeting.mediaProperties.webrtcMediaConnection) {
    return;
  }
  const value = preferLiveVideoElm.value;

  if (value === 'Enable') {
    preferLiveVideo = true;
  }

  if (meeting.remoteMediaManager) {
    meeting.remoteMediaManager.setPreferLiveVideo(preferLiveVideo);
  }

}

async function getStatsForVideoPane(meeting, videoPane) {
  const {remoteMedia} = videoPane;
  const {wcmeReceiveSlot} = remoteMedia.getUnderlyingReceiveSlot();
  const {multistreamConnection} = meeting.mediaProperties.webrtcMediaConnection;

  // there is no public API in WCME to get the transceiver of a receive slot, but
  // this is javascript so we can access private fields to get it anyway until we have some API for this
  const transceiver = [
    ...(multistreamConnection.recvTransceivers.get('VIDEO-MAIN') || []),
    ...(multistreamConnection.recvTransceivers.get('VIDEO-SLIDES') || []),
  ].find((t) => t.receiveSlot === wcmeReceiveSlot);

  let result = {};

  if (transceiver) {
    const statsResult = await transceiver.receiver?.getStats();

    statsResult?.forEach((report) => {
      if (report.type === 'inbound-rtp') {
        // augment the stats with some more useful info
        result = {
          ...report,
          mediaType: remoteMedia.mediaType,
          csi: remoteMedia.csi,
          memberId: remoteMedia.memberId,
          memberDisplayName: getDisplayNameForMemberId(meeting, remoteMedia.memberId),
        };
      }
    });
  }
  else {
    console.warn(`cannot find transceiver for video pane: "${remoteMedia.id}"`);
  }

  return result;
}

let remoteMediaIds = {};

function setSizeHint() {
  const sizeHintValue =  document.getElementById('size-hint-input').value;
  const remoteMediaId = document.getElementById('remote-media-selector').value;

  let [width, height] = sizeHintValue.split(',');

  remoteMediaIds[remoteMediaId].setSizeHint(parseInt(width), parseInt(height))
}

function addRemoteMediaOption(remoteMedia) {
  remoteMediaIds[remoteMedia.id] = remoteMedia;
  const select = document.getElementById('remote-media-selector');

  const option = document.createElement('option');
  option.value = remoteMedia.id;
  option.text = remoteMedia.id;

  select.add(option);
}

function clearRemoteMedia() {
  remoteMediaIds = {};
}

function processNewVideoPane(meeting, paneGroupId, paneId, remoteMedia) {
  const videoPane = allVideoPanes[paneGroupId][paneId];

  addRemoteMediaOption(remoteMedia);

  videoPane.remoteMedia = remoteMedia;
  videoPane.videoEl.srcObject = remoteMedia.stream;

  videoPane.onCtrlClick = async (ev) => {
    const stats = await getStatsForVideoPane(meeting, videoPane);

    console.log(`stats for video pane "${videoPane.remoteMedia.id}": `, stats);
  };

  // update our UI with the current state of the new remote media instance we got and setup listeners for any changes
  updateVideoPane(videoPane, meeting, remoteMedia.sourceState, remoteMedia.memberId, `${paneGroupId}.${paneId} ${remoteMedia.id}`, 'initialization');

  remoteMedia.on('sourceUpdate', (data) => {
    updateVideoPane(videoPane, meeting, data.state, data.memberId, `${paneGroupId}.${paneId} ${remoteMedia.id}`, 'update');
  });
}

async function getStats() {
  const meeting = getCurrentMeeting();

  if (meeting) {
    console.log('Stats for all video panes:');
    // extract the stats for each video pane
    for (const [groupId, paneGroup] of Object.entries(allVideoPanes)) {
      Object.values(paneGroup).forEach(async (videoPane) => {
        const stats = await getStatsForVideoPane(meeting, videoPane);

        console.log(`stats for ${groupId} video pane "${videoPane.remoteMedia.id}": `, stats);
      });
    }
  }
}

const meetingsWithMultistreamListeners = {};
let layoutSelectedBeforeRemoteShareStarted;

function forceLayoutChange(newLayoutId) {
  const selectLayoutElm = document.getElementById('multistream-layout');

  selectLayoutElm.value = newLayoutId;
  selectLayoutElm.dispatchEvent(new Event('change'));
}

function forceScreenShareViewLayout(meeting) {
  // remoteMediaManager might be null if we're in the lobby
  if (meeting.remoteMediaManager) {
    layoutSelectedBeforeRemoteShareStarted = meeting.remoteMediaManager.getLayoutId();

    forceLayoutChange('ScreenShareView');
  }
}

function stopForcedScreenShareViewLayout(meeting) {
  if (meeting.remoteMediaManager) {
    if (meeting.remoteMediaManager.getLayoutId() === 'ScreenShareView') {
      const selectLayoutElm = document.getElementById('multistream-layout');

      const newLayout = layoutSelectedBeforeRemoteShareStarted || selectLayoutElm.firstElementChild.value;

      forceLayoutChange(newLayout);
    }
  }
  layoutSelectedBeforeRemoteShareStarted = undefined;
}


function setupMultistreamEventListeners(meeting) {
  if (meetingsWithMultistreamListeners[meeting.id]) {
    // listeners already registered
    return;
  }

  meeting.on('media:remoteAudio:created', (audioMediaGroup) => {
    console.log('MeetingStreams#setupMultistreamEventListeners :: got AUDIO remote media group created');
    audioMediaGroup.getRemoteMedia().forEach((media, index) => {
      document.getElementsByClassName('multistream-remote-audio')[index].srcObject = media.stream;
    });
  });

  meeting.on('media:remoteScreenShareAudio:created', (screenShareAudioMediaGroup) => {
    document.getElementById('multistream-remote-share-audio').srcObject = screenShareAudioMediaGroup.getRemoteMedia()[0].stream;
  });

  meeting.on('media:remoteVideo:layoutChanged', ({
    layoutId, activeSpeakerVideoPanes, memberVideoPanes, screenShareVideo
  }) => {
    console.log(`MeetingStreams#VideoLayoutChanged :: got video layout changed: layoutId=${layoutId}`);

    console.log('activeSpeakerVideoPanes:', activeSpeakerVideoPanes);
    console.log('memberVideoPanes:', memberVideoPanes);
    console.log('screenShareVideo:', screenShareVideo);

    clearRemoteMedia();
    currentVideoPaneList.length = 0;
    clearAllMultistreamVideoElements();
    createVideoElementsForLayout(layoutId);

    for (const [groupId, group] of Object.entries(activeSpeakerVideoPanes)) {
      group.getRemoteMedia().forEach((remoteMedia, index) => processNewVideoPane(meeting, groupId, index, remoteMedia));
    }

    for (const [paneId, remoteMedia] of Object.entries(memberVideoPanes)) {
      // staged layout is the only one we use that has memberVideoPanes defined
      processNewVideoPane(meeting, 'stage', paneId, remoteMedia);
    }

    if (screenShareVideo) {
      processNewVideoPane(meeting, 'screenShare', 0, screenShareVideo);
    }
  });

  meeting.on('media:remoteVideoSourceCountChanged', (data) => {
    remoteSourcesCount.video.total = data.numTotalSources;
    remoteSourcesCount.video.live = data.numLiveSources;
    updateRemoteSourcesInfo();
  });

  meeting.on('media:remoteAudioSourceCountChanged', (data) => {
    remoteSourcesCount.audio.total = data.numTotalSources;
    remoteSourcesCount.audio.live = data.numLiveSources;
    updateRemoteSourcesInfo();
  });

  meeting.on('media:activeSpeakerChanged', (data) => {
    currentActiveSpeakersMemberIds = data.memberIds;
    updateVideoPanesForActiveSpeaker();
  });

  meeting.on('meeting:stoppedSharingLocal', (reason) => {
    console.log(`event received: stoppedSharingLocal: reason=${reason}`);
  });

  meeting.on('meeting:startedSharingRemote', () => {
    forceScreenShareViewLayout(meeting);
  });

  meeting.on('meeting:stoppedSharingRemote', () => {
    stopForcedScreenShareViewLayout(meeting);
  });

  meetingsWithMultistreamListeners[meeting.id] = true;
}

function enableMultistreamControls(enable) {
  multistreamLayoutElm.disabled = !enable;
  getStatsButton.disabled = !enable;
}

function addMediaOptionsLocal(elementId) {
  const mediaOptions = ['360p', '480p', '720p', '1080p'];
  const element = document.getElementById(elementId);
  const optionElements = mediaOptions.reduce((acc, resolution) => {
    acc += `<option value="${resolution}" ${resolution === '720p' && 'selected'}>${resolution}</option>`;

    return acc;
  }, '');

  element.innerHTML = optionElements;
}

function addMediaOptionsRemote(elementId) {
  const mediaOptions = ['LOW', 'MEDIUM', 'HIGH'];
  const element = document.getElementById(elementId);
  const optionElements = mediaOptions.reduce((acc, resolution) => {
    acc += `<option value="${resolution}" ${resolution === 'HIGH' && 'selected'}>${resolution}</option>`;

    return acc;
  }, '');

  element.innerHTML = optionElements;
}

(() => {
  addMediaOptionsLocal('local-resolution');
  addMediaOptionsRemote('remote-resolution');
})();

function addMedia() {
  const meeting = getCurrentMeeting();

  console.log('MeetingStreams#addMedia()');

  if (!meeting) {
    console.log('MeetingStreams#addMedia() :: no valid meeting object!');
  }

  doPreMediaSetup(meeting);

  // addMedia using the default RemoteMediaManagerConfig
  meeting.addMedia({
    localStreams: {
      microphone: localMedia.microphoneStream,
      camera: localMedia.cameraStream,
      screenShare: {
        audio: localMedia.screenShare?.audio,
        video: localMedia.screenShare?.video
      }
    },
    ...getMediaSettings()
  }
  ).then(() => {
    doPostMediaSetup(meeting);
    console.log('MeetingStreams#addMedia() :: successfully added media!');
  }).catch((error) => {
    console.log('MeetingStreams#addMedia() :: Error adding media!');

    //resetting here as failure of addMedia call means every setting should be default checked
    resetMediaSettingsToDefaults();

    console.error(error);
  });
}

function updateLayoutHeightWidth() {
  layoutHeightInp.value = meetingStreamsRemoteVideo.scrollHeight;
  layoutWidthInp.value = meetingStreamsRemoteVideo.scrollWidth;
}

function changeLayout() {
  const layoutVal = document.getElementById('layout-type').value;
  const height = layoutHeightInp.value;
  const width = layoutWidthInp.value;
  const currentMeeting = getCurrentMeeting();

  currentMeeting.changeVideoLayout(layoutVal, {main: {height, width}})
    .then(() => {
      console.log('Remote Video Layout changed successfully');
    })
    .catch((err) => {
      console.error(err);
    });
}

let currentDevice;

const sourceDevicesPairWebexDevice = document.querySelector('#sd-pair-webex-device');
const devicesListItemsElm = document.querySelector('#devices-list-items');
const currentDevicePairState = document.querySelector('#device-pair-state');
const currentDeviceDetailsElm = document.querySelector('#current-device-details');
const currentDeviceAudioStateElm = document.querySelector('#current-device-audio-state');
const currentDevicePinQueryElm = document.querySelector('#device-pin-query');
const findDevicesQueryElm = document.querySelector('#find-devices-query');
const findDevicesStatusElm = document.querySelector('#find-devices-status');
const findDevicesListElm = document.querySelector('#find-devices-list');
const pmrIdElm = document.querySelector('#pmr-id');
const pmrPinElm = document.querySelector('#pmr-pin');
const pmrDetailsElm = document.querySelector('#pmr-details');

function toggleWebexDeviceSection() {
  const webexSec = document.getElementById('webex-device-pairing-sec');

  if (webexSec.classList.contains('hidden')) {
    sourceDevicesPairWebexDevice.innerText = 'Hide Pairing Section';
    webexSec.classList.remove('hidden');
  }
  else {
    sourceDevicesPairWebexDevice.innerText = 'Pair';
    webexSec.classList.add('hidden');
  }
}

function selectDevice(device) {
  console.log('MeetingsDevices#selectDevice()');

  currentDevice = device;

  currentDeviceDetailsElm.innerText = JSON.stringify(device, null, 2);
  currentDeviceAudioStateElm.innerText = 'Device audio state has not been queried yet';
}

function deviceRequestUnpair() {
  console.log('MeetingsDevices#deviceRequestUnpair()');

  currentDevicePairState.innerText = 'Unpairing...';

  webex.devicemanager.unpair()
    .then(() => {
      currentDevicePairState.innerText = 'Not Paired';

      // disable join with device button
      document.getElementById('btn-join-device').disabled = true;


      document.querySelector('#p-paired-device-id').innerText = '';
    })
    .catch((error) => {
      currentDevicePairState.innerText = `Paired to ${currentDevice.deviceInfo.description} [${currentDevice.id}]`;

      throw error;
    });
}

function deviceRequestPair() {
  console.log('MeetingsDevices#deviceRequestPair()');

  currentDevicePairState.innerText = 'Pairing...';

  webex.devicemanager.pair({
    pin: currentDevicePinQueryElm.value
  })
    .then(() => {
      currentDevicePairState.innerText = `Paired to ${currentDevice.deviceInfo.description} [${currentDevice.id}]`;

      // enable join with device button
      document.getElementById('btn-join-device').disabled = false;

      // display device ID
      document.querySelector('#p-paired-device-id').innerText = `Paired Device: ${currentDevice.deviceInfo.description} [${currentDevice.id}]`;
    })
    .catch((error) => {
      currentDevicePairState.innerText = error.message;

      throw error;
    });
}

function generateMeetingsDevicesListItem(device) {
  const itemElm = document.createElement('div');
  const selectElm = document.createElement('button');
  const removeElm = document.createElement('button');
  const detailsElm = document.createElement('label');

  itemElm.id = `meeting-list-item-${device.id}`;
  itemElm.key = device.id;

  selectElm.onclick = () => selectDevice(device);
  selectElm.type = 'button';
  selectElm.value = device.id;
  selectElm.innerText = 'Select';

  removeElm.onclick = () => webex.devicemanager.remove(device.id);
  removeElm.type = 'button';
  removeElm.value = device.id;
  removeElm.innerText = 'webex.devicemanager.remove()';

  detailsElm.innerText = `${device.deviceInfo.description} [${device.id}]`;

  itemElm.appendChild(selectElm);
  itemElm.appendChild(removeElm);
  itemElm.appendChild(detailsElm);

  return itemElm;
}

function generateMeetingsDevicesSearchItem(device) {
  const itemElm = document.createElement('div');
  const selectElm = document.createElement('button');
  const detailsElm = document.createElement('label');

  console.log('device', device);

  itemElm.setAttribute('id', `meeting-list-item-${device.id}`);
  itemElm.setAttribute('key', device.id);

  selectElm.onclick = () => selectDevice(device);
  selectElm.setAttribute('type', 'button');
  selectElm.setAttribute('value', device.id);
  selectElm.innerText = 'Select';

  detailsElm.innerText = `${device.description || device.name} [${device.id}]`;

  itemElm.appendChild(selectElm);
  itemElm.appendChild(detailsElm);

  return itemElm;
}

function deviceGetAudioState() {
  console.log('MeetingsDevices#refreshDevicesList()');

  webex.devicemanager.getAudioState()
    .then((state) => {
      currentDeviceAudioStateElm.innerText = JSON.stringify(state, null, 2);
    });
}

function refreshDevicesList() {
  console.log('MeetingsDevices#refreshDevicesList()');

  devicesListItemsElm.innerText = '';

  webex.devicemanager.refresh()
    .then((devices) => {
      if (devices.length === 0) {
        devicesListItemsElm.innerText =
          'There are currently no meetings devices to display';

        return;
      }

      devices.forEach(
        (device) => devicesListItemsElm.appendChild(
          generateMeetingsDevicesListItem(device)
        )
      );
    });
}

function searchForDevices() {
  console.log('DevicesControls#searchForDevices()');
  findDevicesStatusElm.innerText = 'Searching...';
  findDevicesListElm.innerText = '';

  const searchQuery = findDevicesQueryElm.value;

  if (searchQuery && searchQuery.length < 3) {
    const msg = 'device query must contain 3 characters or more';

    findDevicesStatusElm.innerText = msg;

    throw new Error(msg);
  }

  webex.devicemanager.search({searchQuery})
    .then((results) => {
      results.forEach(
        (device) => findDevicesListElm.appendChild(
          generateMeetingsDevicesSearchItem(device)
        )
      );

      findDevicesStatusElm.innerText = '';
    })
    .catch((error) => {
      findDevicesQueryElm.innerText = error.message;
    });
}

function changeAudioState(command) {
  webex.devicemanager[command]()
    .then((res) => {
      console.log(res);
      // currentDeviceAudioStateElm.innerText = JSON.stringify(audio, null, 2);
    });
}

function moveToDevice() {
  const deviceId = webex.devicemanager._pairedDevice ? webex.devicemanager._pairedDevice.identity.id : undefined;

  if (!deviceId) {
    console.error('Pair a device first');

    return;
  }

  const currentMeeting = getCurrentMeeting();

  if (!currentMeeting) {
    console.error('Join a meeting');

    return;
  }

  currentMeeting.moveTo(deviceId).then(() => {
    console.log('Meeting moved to Device');
  }).catch((err) => {
    console.error(err);
  });
}

function moveFromDevice() {
  const deviceId = webex.devicemanager._pairedDevice ? webex.devicemanager._pairedDevice.identity.id : undefined;

  if (!deviceId) {
    console.error('Pair a device first');

    return;
  }

  const currentMeeting = getCurrentMeeting();

  if (!currentMeeting) {
    console.error('Join a meeting');

    return;
  }

  currentMeeting.moveFrom(deviceId).then(() => {
    console.log('Meeting moved to computer');
  }).catch((err) => {
    console.error(err);
  });
}

function isMemberSelf(member) {
  const meeting = getCurrentMeeting();
  return meeting.selfId === member.id
}

function claimPersonalMeetingRoom() {
  console.log('DevicesControls#claimPersonalMeetingRoom()');

  pmrDetailsElm.innerText = 'Attempting to claim';

  const pmrId = pmrIdElm.value;
  const pmrPin = pmrPinElm.value;

  if (!pmrId || !pmrPin) {
    const msg = 'a pmr id and pmr pin must be provided';

    pmrDetailsElm.innerText = msg;

    throw new Error(msg);
  }

  webex.meetings.personalMeetingRoom.claim(pmrId, pmrPin)
    .then((pmr) => {
      console.log('pmr claimed', pmr);

      pmrDetailsElm.innerText = JSON.stringify(
        webex.meetings.personalMeetingRoom, null, 2
      );
    })
    .catch((error) => {
      pmrDetailsElm.innerText = error.message;
    });
}
// The terms Members and Participants are used interchangeably
// participants Section
const participantsList = document.querySelector('#participant-list');
const participantTable = document.querySelector('#participant-table');
const participantButtons = document.querySelector('#participant-btn');

participantTable.addEventListener('click', (event) => {
  if (event.target.type === 'radio') {
    const selectedParticipant = meeting.members.membersCollection.get(event.target.id);
    if (!selectedParticipant) {
      return;
    }
    const muteButton = document.getElementById('mute-participant-btn')
    if (selectedParticipant.isAudioMuted) {
      muteButton.innerText = isMemberSelf(selectedParticipant) ? 'Unmute' : 'Request to unmute';
    } else {
      muteButton.innerText = 'Mute';
    }
  }
});

function inviteMember(addButton) {
  const meeting = getCurrentMeeting();
  const emailVal = addButton.previousElementSibling.value.trim();

  if (meeting) {
    meeting.invite({emailAddress: emailVal}).then((res) => {
      console.log(res.body.locus);
      const participantsArr = res.body.locus.participants;
      let mostRecentParticipantId;
      let mostRecentparticipantName;
      let mostRecentparticipantStatusObj;

      participantsArr.forEach((obj) => {
        if (obj.person.email === emailVal ||
          obj.person.primaryDisplayString === emailVal) {
          mostRecentParticipantId = obj.id;
          mostRecentparticipantName = obj.person.name ||
          obj.person.primaryDisplayString;
          mostRecentparticipantStatusObj = obj.state;
        }
      });

      viewParticipants();
    }).catch((err) => {
      console.log('unable to invite participant', err);
    });
  }
}

function removeMember(removeButton) {
  const meeting = getCurrentMeeting();
  const participantID = getRadioValue('participant-select');

  if (meeting) {
    meeting.remove(participantID).then((res) => {
      console.log(res, 'participant has been removed');
    }).catch((err) => {
      console.log('unable to remove participant', err);
    });
  }
}

function muteMember(muteButton) {
  const meeting = getCurrentMeeting();
  const participantID = getRadioValue('participant-select');
  const selectedMember = meeting.members.membersCollection.get(participantID);
  const newMuteStatus = selectedMember.isAudioMuted ? false : true;

  if (meeting) {
    meeting.mute(participantID, newMuteStatus).then((res) => {
      console.log(res, `participant is ${newMuteStatus ? 'muted' : 'unmuted'}`);
    }).catch((err) => {
      console.log('error', err);
    });
  }
}

function transferHostToMember(transferButton) {
  const meeting = getCurrentMeeting();
  const participantID = getRadioValue('participant-select');

  if (meeting) {
    meeting.transfer(participantID).then((res) => {
      console.log(res, `succesful tranfer to ${participantID}`);
    }).catch((err) => {
      console.log('error', err);
    });
  }
}

const createButton = (text, func, props = {}) => {
  const button = document.createElement('button');

  button.onclick = (e) => func(e.target);
  button.innerText = text;
  button.setAttribute('type', 'button');

  Object.entries(props).forEach(([key, value]) => {
    button.setAttribute(key, value);
  });

  return button;
}

function updateBreakoutAssignmentOptions() {
  const assignmentMethod = document.querySelector('input[name="breakout-assignment-method"]:checked')?.value;

  breakoutAutomaticOptionsElm.classList.toggle('hidden', assignmentMethod !== 'automatic');
}

function setBreakoutStatus(message, isError = false) {
  breakoutStatusElm.innerText = message;
  breakoutStatusElm.style.color = isError ? '#b70303' : '';
}

function resetBreakoutSessions() {
  breakoutSessionConfiguration = undefined;
  breakoutSessionsCreated = false;
  breakoutSessionsStarted = false;
  breakoutBroadcastDraft = {
    targetSessionId: 'all',
    role: 'all',
    message: '',
  };
  document.getElementById('breakout-session-count').value = 1;
  document.getElementById('breakout-assignment-automatic').checked = true;
  document.getElementById('breakout-assignment-manual').checked = false;
  document.getElementById('breakout-assignment-choose').checked = false;
  document.getElementById('breakout-assign-cohosts').checked = false;
  document.getElementById('breakout-include-lobby').checked = false;
  breakoutCreateButtonElm.disabled = false;
  breakoutStartButtonElm.disabled = false;
  breakoutStartButtonElm.classList.add('hidden');
  breakoutResetButtonElm.disabled = false;
  breakoutResetButtonElm.classList.add('hidden');
  breakoutTableElm.classList.add('hidden');
  breakoutTableElm.innerHTML = '';
  updateBreakoutAssignmentOptions();
}

function waitForBreakoutSessionsToClose(currentMeeting) {
  if (!currentMeeting.breakouts.isBreakoutInProgress()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let timeoutId;
    const handleBreakoutUpdate = () => {
      if (!currentMeeting.breakouts.isBreakoutInProgress()) {
        window.clearTimeout(timeoutId);
        currentMeeting.off('meeting:breakouts:update', handleBreakoutUpdate);
        resolve();
      }
    };

    timeoutId = window.setTimeout(() => {
      currentMeeting.off('meeting:breakouts:update', handleBreakoutUpdate);
      reject(new Error('Timed out waiting for active breakout sessions to close.'));
    }, 10000);
    currentMeeting.on('meeting:breakouts:update', handleBreakoutUpdate);
    handleBreakoutUpdate();
  });
}

async function resetBreakoutSessionSetup() {
  const currentMeeting = getCurrentMeeting();

  if (!currentMeeting) {
    setBreakoutStatus('Select and join a meeting before resetting breakout sessions.', true);

    return;
  }

  breakoutResetButtonElm.disabled = true;
  breakoutStartButtonElm.disabled = true;
  breakoutCreateButtonElm.disabled = true;
  setBreakoutStatus('Resetting breakout sessions...');

  try {
    if (breakoutSessionsStarted && currentMeeting.breakouts.isBreakoutInProgress()) {
      setBreakoutStatus('Ending active breakout sessions before reset...');
      await currentMeeting.breakouts.end({delayCloseTime: 0});
      await waitForBreakoutSessionsToClose(currentMeeting);
    }

    if (breakoutSessionsCreated) {
      setBreakoutStatus('Deleting breakout sessions...');
      await currentMeeting.breakouts.clearSessions();
    }

    resetBreakoutSessions();
    breakoutConfigurationElm.classList.remove('hidden');
    setBreakoutStatus('Breakout sessions reset. Create a new configuration.');
  }
  catch (error) {
    breakoutResetButtonElm.disabled = false;
    breakoutStartButtonElm.disabled = false;
    breakoutCreateButtonElm.disabled = breakoutSessionsCreated;
    setBreakoutStatus('Unable to reset breakout sessions. See the console for details.', true);
    console.error('Breakout#resetBreakoutSessionSetup :: ', error);
  }
}

async function toggleBreakout() {
  const currentMeeting = getCurrentMeeting();
  const shouldEnable = enableBreakoutElm.checked;

  if (!currentMeeting) {
    enableBreakoutElm.checked = false;
    breakoutConfigurationElm.classList.add('hidden');
    setBreakoutStatus('Select and join a meeting before enabling breakout sessions.', true);

    return;
  }

  enableBreakoutElm.disabled = true;
  setBreakoutStatus(`${shouldEnable ? 'Enabling' : 'Disabling'} breakout sessions...`);

  try {
    await currentMeeting.breakouts.toggleBreakout(shouldEnable);
    breakoutConfigurationElm.classList.toggle('hidden', !shouldEnable);

    if (shouldEnable) {
      updateBreakoutAssignmentOptions();
      setBreakoutStatus('Breakout sessions enabled. Configure the sessions below.');
    }
    else {
      resetBreakoutSessions();
      setBreakoutStatus('Breakout sessions disabled.');
    }
  }
  catch (error) {
    enableBreakoutElm.checked = !shouldEnable;
    breakoutConfigurationElm.classList.toggle('hidden', shouldEnable);
    setBreakoutStatus('Unable to update breakout sessions. See the console for details.', true);
    console.error('Breakout#toggleBreakout :: ', error);
  }
  finally {
    enableBreakoutElm.disabled = false;
  }
}

function prepareBreakoutSessions() {
  const currentMeeting = getCurrentMeeting();
  const sessionCount = Number(document.getElementById('breakout-session-count').value);
  const assignmentMethod = document.querySelector('input[name="breakout-assignment-method"]:checked')?.value;

  if (!currentMeeting) {
    setBreakoutStatus('Select and join a meeting before creating breakout sessions.', true);

    return;
  }

  if (!Number.isInteger(sessionCount) || sessionCount < 1) {
    setBreakoutStatus('Enter a valid number of breakout sessions.', true);

    return;
  }

  const sessions = Array.from({length: sessionCount}, (_, index) => ({
    name: `Session ${index + 1}`,
    anyoneCanJoin: assignmentMethod === 'choose',
  }));

  breakoutSessionConfiguration = {
    sessionCount,
    assignmentMethod,
    assignCohostsAutomatically: assignmentMethod === 'automatic' &&
      document.getElementById('breakout-assign-cohosts').checked,
    includeLobbyParticipants: assignmentMethod === 'automatic' &&
      document.getElementById('breakout-include-lobby').checked,
    sessions,
  };

  breakoutTableElm.classList.add('hidden');
  breakoutTableElm.innerHTML = '';
  breakoutStartButtonElm.disabled = false;
  breakoutStartButtonElm.classList.remove('hidden');
  breakoutResetButtonElm.disabled = false;
  breakoutResetButtonElm.classList.remove('hidden');
  renderBreakoutSessions(currentMeeting);

  console.log('Breakout#prepareBreakoutSessions :: ', breakoutSessionConfiguration);
  setBreakoutStatus(
    `Configuration ready for ${sessionCount} breakout session${sessionCount === 1 ? '' : 's'}. Click Start Breakout Sessions.`
  );
}

function getBreakoutSessionId(session) {
  return session?.sessionId || session?.id;
}

function getBreakoutConfiguredSession(session) {
  const sessionId = getBreakoutSessionId(session);
  const configuredSessions = breakoutSessionConfiguration?.sessions || [];

  if (!sessionId) {
    return configuredSessions.find((configuredSession) => configuredSession === session);
  }

  return configuredSessions.find((configuredSession) =>
    getBreakoutSessionId(configuredSession) === sessionId
  );
}

function getBreakoutManagedSession(currentMeeting, session) {
  const sessionId = getBreakoutSessionId(session);
  const groups = currentMeeting.breakouts.manageGroups || [];

  return groups
    .flatMap((group) => group.sessions || [])
    .find((managedSession) => getBreakoutSessionId(managedSession) === sessionId);
}

function doesBreakoutSessionAllowAnyone(currentMeeting, session) {
  const configuredSession = getBreakoutConfiguredSession(session);
  const managedSession = getBreakoutManagedSession(currentMeeting, session);

  return Boolean(
    configuredSession?.anyoneCanJoin ||
    managedSession?.anyoneCanJoin ||
    session?.anyoneCanJoin
  );
}

function applyBreakoutSessionChanges(currentMeeting, session, changes) {
  const configuredSession = getBreakoutConfiguredSession(session);
  const managedSession = getBreakoutManagedSession(currentMeeting, session);

  if (Object.prototype.hasOwnProperty.call(changes, 'name')) {
    if (typeof session.set === 'function') {
      session.set('name', changes.name);
    }
    else {
      session.name = changes.name;
    }
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'anyoneCanJoin')) {
    session.anyoneCanJoin = changes.anyoneCanJoin;
  }

  if (configuredSession && configuredSession !== session) {
    Object.assign(configuredSession, changes);
  }
  if (managedSession && managedSession !== session && managedSession !== configuredSession) {
    Object.assign(managedSession, changes);
  }
}

async function updateBreakoutSession(currentMeeting, session, changes) {
  const sessionId = getBreakoutSessionId(session);

  if (!sessionId) {
    throw new Error('The breakout session ID is unavailable.');
  }

  try {
    await currentMeeting.breakouts.getBreakout(true);

    const groupId = session.groupId || currentMeeting.breakouts.breakoutGroupId;

    if (!groupId) {
      throw new Error('The breakout group ID is unavailable.');
    }

    await currentMeeting.breakouts.update({
      id: groupId,
      sessions: [{id: sessionId, ...changes}],
    }, true);
    applyBreakoutSessionChanges(currentMeeting, session, changes);
  }
  catch (error) {
    if (currentMeeting.breakouts.editLock?.token) {
      currentMeeting.breakouts.unLockEditBreakout();
    }

    throw error;
  }
}

function getBreakoutSessionModels(currentMeeting) {
  const sessionModels = currentMeeting.breakouts.breakouts?.models || [];
  const configuredSessionIds = new Set(
    (breakoutSessionConfiguration?.sessions || [])
      .map((session) => getBreakoutSessionId(session))
      .filter(Boolean)
  );
  const shouldScopeToConfiguredSessions = breakoutSessionsStarted &&
    breakoutSessionConfiguration?.assignmentMethod === 'manual' &&
    configuredSessionIds.size > 0;
  const breakoutSessions = sessionModels.filter((session) =>
    !session.isMain &&
    (!shouldScopeToConfiguredSessions ||
      configuredSessionIds.has(getBreakoutSessionId(session)))
  );
  const currentSession = currentMeeting.breakouts.currentBreakoutSession;
  const currentSessionId = getBreakoutSessionId(currentSession);
  const isConfiguredSession = !shouldScopeToConfiguredSessions ||
    configuredSessionIds.has(currentSessionId);

  if (currentSessionId && !currentSession.isMain && isConfiguredSession &&
    !breakoutSessions.some((session) => getBreakoutSessionId(session) === currentSessionId)) {
    breakoutSessions.unshift(currentSession);
  }

  return breakoutSessions;
}

function getBreakoutDisplaySessions(currentMeeting) {
  const sessionModels = getBreakoutSessionModels(currentMeeting);
  const configuredSessions = breakoutSessionConfiguration?.sessions || [];
  const sessionModelsById = new Map(
    sessionModels.map((session) => [getBreakoutSessionId(session), session])
  );
  const hasConfiguredSessionIds = configuredSessions.some((session) =>
    getBreakoutSessionId(session)
  );

  if (!breakoutSessionsCreated) {
    return configuredSessions;
  }

  if (breakoutSessionsStarted &&
    breakoutSessionConfiguration?.assignmentMethod === 'manual' &&
    hasConfiguredSessionIds) {
    return configuredSessions.map((session) =>
      sessionModelsById.get(getBreakoutSessionId(session)) || session
    );
  }

  return sessionModels.length ? sessionModels : configuredSessions;
}

function getBreakoutSessionMembers(currentMeeting, session) {
  const currentSession = currentMeeting.breakouts.currentBreakoutSession;
  const isCurrentSession = getBreakoutSessionId(currentSession) === getBreakoutSessionId(session);
  const membersCollection = isCurrentSession ?
    currentMeeting.members?.membersCollection : session.members?.membersCollection;
  const members = membersCollection?.getAll?.() || {};

  return Object.values(members).filter((member) => member.status !== 'NOT_IN_MEETING');
}

function isBreakoutCurrentUser(currentMeeting, member) {
  const selfIds = [currentMeeting.selfId, currentMeeting.userId, currentMeeting.members?.selfId];

  return member.isSelf || selfIds.includes(member.id);
}

function getBreakoutAutomaticParticipants(currentMeeting) {
  const members = currentMeeting.members?.membersCollection?.getAll?.() || {};
  const {assignCohostsAutomatically, includeLobbyParticipants} = breakoutSessionConfiguration;

  return Object.values(members).filter((member) => {
    const isCohost = member.roles?.cohost || member.isModerator;

    return !isBreakoutCurrentUser(currentMeeting, member) &&
      !member.isHost &&
      !member.isDevice &&
      member.status !== 'NOT_IN_MEETING' &&
      member.supportsBreakouts !== false &&
      (includeLobbyParticipants || !member.isInLobby) &&
      (assignCohostsAutomatically || !isCohost);
  });
}

function createBreakoutAutomaticAssignments(currentMeeting, sessions) {
  const participants = getBreakoutAutomaticParticipants(currentMeeting);
  const assignments = sessions.map((session) => ({
    id: getBreakoutSessionId(session),
    memberIds: [],
    anyone: false,
  }));

  if (!assignments.length || assignments.some((assignment) => !assignment.id)) {
    throw new Error('The breakout service did not return IDs for the created sessions.');
  }

  participants.forEach((participant, index) => {
    assignments[index % assignments.length].memberIds.push(participant.id);
  });

  return {assignments, participants};
}

function isBreakoutHostInSession(currentMeeting, session) {
  const selfIds = [currentMeeting.selfId, currentMeeting.userId, currentMeeting.members?.selfId];
  const isHost = selfIds.includes(currentMeeting.members?.hostId);
  const currentSession = currentMeeting.breakouts.currentBreakoutSession;

  return isHost && !currentSession?.isMain &&
    getBreakoutSessionId(currentSession) === getBreakoutSessionId(session);
}

function getBreakoutMemberRole(currentMeeting, member) {
  const roles = [];

  if (member.isHost) {
    roles.push('Host');
  }
  if (member.roles?.cohost) {
    roles.push('Cohost');
  }
  if (member.roles?.presenter) {
    roles.push('Presenter');
  }
  if (isBreakoutCurrentUser(currentMeeting, member)) {
    roles.push('me');
  }

  return roles.length ? roles.join(', ') : 'Participant';
}

function refreshBreakoutRostersAfterAction(currentMeeting) {
  if (!currentMeeting?.breakouts?.queryRosters) {
    return;
  }

  currentMeeting.breakouts.queryRosters();
  window.setTimeout(() => {
    if (getCurrentMeeting() === currentMeeting) {
      currentMeeting.breakouts.queryRosters();
    }
  }, 1500);
}

async function runBreakoutParticipantAction(actionName, operation) {
  const currentMeeting = getCurrentMeeting();

  setBreakoutStatus(`${actionName}...`);

  try {
    await operation(currentMeeting);
    setBreakoutStatus(`${actionName} completed.`);

    return true;
  }
  catch (error) {
    setBreakoutStatus(`${actionName} failed. See the console for details.`, true);
    console.error(`Breakout#${actionName} :: `, error);

    return false;
  }
  finally {
    refreshBreakoutRostersAfterAction(currentMeeting);
  }
}

function createBreakoutDynamicAssignment(sessionId, participantIds) {
  const participants = Array.isArray(participantIds) ? participantIds : [participantIds];

  if (!sessionId || !participants.length || participants.some((participantId) => !participantId)) {
    throw new Error('A breakout session and participant are required for this action.');
  }

  return {
    id: sessionId,
    participants,
    targetState: 'JOINED',
  };
}

function exchangeBreakoutParticipants(
  currentMeeting,
  sourceSession,
  sourceMember,
  targetSession,
  targetMember
) {
  const sourceSessionId = getBreakoutSessionId(sourceSession);
  const targetSessionId = getBreakoutSessionId(targetSession);

  if (sourceSessionId === targetSessionId) {
    throw new Error('Exchange participants must be in different breakout sessions.');
  }

  if (sourceMember.id === targetMember.id) {
    throw new Error('Select two different participants to exchange.');
  }

  const moveTargetMemberToSource = createBreakoutDynamicAssignment(
    sourceSessionId,
    targetMember.id
  );
  const moveSourceMemberToTarget = createBreakoutDynamicAssignment(
    targetSessionId,
    sourceMember.id
  );

  return currentMeeting.breakouts.dynamicAssign([
    moveTargetMemberToSource,
    moveSourceMemberToTarget,
  ]);
}

function getBreakoutExchangeOptions(currentMeeting, sourceSession, sourceMember) {
  const sourceSessionId = getBreakoutSessionId(sourceSession);

  return getBreakoutSessionModels(currentMeeting)
    .filter((targetSession) => getBreakoutSessionId(targetSession) !== sourceSessionId)
    .flatMap((targetSession) => getBreakoutSessionMembers(currentMeeting, targetSession)
      .filter((targetMember) => targetMember.id && targetMember.id !== sourceMember.id)
      .map((targetMember) => ({
        label: `${targetMember.name} (${targetSession.name})`,
        value: {targetMember, targetSession},
      })));
}

function getBreakoutUnassignedParticipants(currentMeeting) {
  const meetingMembers = currentMeeting.members?.membersCollection?.getAll?.() || {};
  const sessionModels = currentMeeting.breakouts.breakouts?.models || [];
  const mainSession = sessionModels.find((session) => session.isMain);
  const mainSessionMembers = mainSession?.members?.membersCollection?.getAll?.() || {};
  const candidateMembers = new Map();
  const assignedParticipantIds = new Set();

  [...Object.values(meetingMembers), ...Object.values(mainSessionMembers)].forEach((member) => {
    if (member.id) {
      candidateMembers.set(member.id, member);
    }
  });

  getBreakoutSessionModels(currentMeeting).forEach((session) => {
    getBreakoutSessionMembers(currentMeeting, session).forEach((member) => {
      if (member.id) {
        assignedParticipantIds.add(member.id);
      }
    });
  });

  const unassignedParticipants = [...candidateMembers.values()].filter((member) =>
    !assignedParticipantIds.has(member.id) &&
    !member.isDevice &&
    member.supportsBreakouts !== false &&
    member.status !== 'NOT_IN_MEETING'
  );

  return {
    inMeeting: unassignedParticipants.filter((member) => !member.isInLobby),
    inLobby: unassignedParticipants.filter((member) => member.isInLobby),
  };
}

async function moveBreakoutParticipantsToSession(currentMeeting, targetSession, participants) {
  const targetSessionId = getBreakoutSessionId(targetSession);
  const currentUser = participants.find((participant) =>
    isBreakoutCurrentUser(currentMeeting, participant)
  );
  const otherParticipantIds = participants
    .filter((participant) => participant !== currentUser)
    .map((participant) => participant.id);

  if (otherParticipantIds.length) {
    await currentMeeting.breakouts.dynamicAssign([
      createBreakoutDynamicAssignment(targetSessionId, otherParticipantIds),
    ]);
  }

  if (currentUser) {
    const targetSessionModel = getBreakoutSessionModels(currentMeeting)
      .find((session) => getBreakoutSessionId(session) === targetSessionId) || targetSession;

    if (typeof targetSessionModel.join !== 'function') {
      throw new Error(`Unable to join ${targetSession.name}; the breakout session is not active.`);
    }

    await targetSessionModel.join();
  }
}

function showBreakoutActionPicker(container, options, actionLabel, onConfirm) {
  const existingPicker = container.querySelector('.breakout-action-picker');

  if (existingPicker) {
    existingPicker.remove();
  }

  if (!options.length) {
    setBreakoutStatus(`No available target for ${actionLabel.toLowerCase()}.`, true);

    return;
  }

  const picker = document.createElement('div');
  const select = document.createElement('select');
  const confirmButton = createButton(actionLabel, async (button) => {
    const selectedOption = options[Number(select.value)];

    button.disabled = true;
    select.disabled = true;
    const completed = await onConfirm(selectedOption.value);

    if (completed) {
      picker.remove();
    }
    else {
      button.disabled = false;
      select.disabled = false;
    }
  });
  const cancelButton = createButton('Cancel', () => picker.remove());

  picker.classList.add('breakout-action-picker');
  select.setAttribute('aria-label', `${actionLabel} target`);

  options.forEach((option, index) => {
    const selectOption = document.createElement('option');

    selectOption.value = index;
    selectOption.innerText = option.label;
    select.appendChild(selectOption);
  });

  picker.appendChild(select);
  picker.appendChild(confirmButton);
  picker.appendChild(cancelButton);
  container.appendChild(picker);
}

function createBreakoutUnassignedGroup(currentMeeting, title, members) {
  const group = document.createElement('div');
  const heading = document.createElement('h4');
  const table = document.createElement('table');
  const tableHead = document.createElement('thead');
  const tableBody = document.createElement('tbody');
  const headerRow = document.createElement('tr');

  group.classList.add('breakout-unassigned-group');
  heading.innerText = `${title} (${members.length})`;
  table.classList.add('breakout-unassigned-table');

  ['Select', 'Participant', 'Role'].forEach((header) => {
    const headerCell = document.createElement('th');

    headerCell.innerText = header;
    headerRow.appendChild(headerCell);
  });

  if (!members.length) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');

    emptyCell.colSpan = 3;
    emptyCell.innerText = `No unassigned participants ${title.toLowerCase()}.`;
    emptyRow.appendChild(emptyCell);
    tableBody.appendChild(emptyRow);
  }
  else {
    members.forEach((member) => {
      const row = document.createElement('tr');
      const selectCell = document.createElement('td');
      const nameCell = document.createElement('td');
      const roleCell = document.createElement('td');
      const checkbox = document.createElement('input');

      checkbox.type = 'checkbox';
      checkbox.name = 'breakout-unassigned-participant';
      checkbox.value = member.id;
      checkbox.setAttribute('aria-label', `Select ${member.name}`);
      nameCell.innerText = member.name;
      roleCell.innerText = getBreakoutMemberRole(currentMeeting, member);

      selectCell.appendChild(checkbox);
      row.appendChild(selectCell);
      row.appendChild(nameCell);
      row.appendChild(roleCell);
      tableBody.appendChild(row);
    });
  }

  tableHead.appendChild(headerRow);
  table.appendChild(tableHead);
  table.appendChild(tableBody);
  group.appendChild(heading);
  group.appendChild(table);

  return group;
}

function createBreakoutUnassignedParticipantsTable(currentMeeting, sessions) {
  const {inMeeting, inLobby} = getBreakoutUnassignedParticipants(currentMeeting);
  const participants = [...inMeeting, ...inLobby];
  const container = document.createElement('div');
  const title = document.createElement('h3');
  const actions = document.createElement('div');
  const selectAllLabel = document.createElement('label');
  const selectAllCheckbox = document.createElement('input');
  const moveControls = document.createElement('div');

  function getParticipantCheckboxes() {
    return [...container.querySelectorAll('input[name="breakout-unassigned-participant"]')];
  }

  function updateSelectionControls() {
    const checkboxes = getParticipantCheckboxes();
    const selectedCount = checkboxes.filter((checkbox) => checkbox.checked).length;

    selectAllCheckbox.checked = Boolean(checkboxes.length) && selectedCount === checkboxes.length;
    selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < checkboxes.length;
    moveButton.disabled = selectedCount === 0;
  }

  container.classList.add('breakout-unassigned');
  title.innerText = `Not Assigned Participants (${participants.length})`;
  actions.classList.add('breakout-unassigned-actions');
  moveControls.classList.add('breakout-unassigned-move-controls');
  selectAllCheckbox.type = 'checkbox';
  selectAllCheckbox.disabled = participants.length === 0;
  selectAllLabel.appendChild(selectAllCheckbox);
  selectAllLabel.appendChild(document.createTextNode('Select all'));

  container.appendChild(title);
  container.appendChild(createBreakoutUnassignedGroup(currentMeeting, 'In the meeting', inMeeting));
  container.appendChild(createBreakoutUnassignedGroup(currentMeeting, 'In the lobby', inLobby));

  const moveButton = createButton('Move to session', () => {
    const selectedParticipantIds = getParticipantCheckboxes()
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);
    const selectedParticipants = participants.filter((participant) =>
      selectedParticipantIds.includes(participant.id)
    );
    const options = sessions
      .filter((session) => getBreakoutSessionId(session))
      .map((session) => ({label: session.name, value: session}));

    if (!selectedParticipantIds.length) {
      setBreakoutStatus('Select at least one unassigned participant.', true);

      return;
    }

    showBreakoutActionPicker(moveControls, options, 'Move', async (targetSession) => {
      const completed = await runBreakoutParticipantAction(
        `Moving ${selectedParticipantIds.length} participant${selectedParticipantIds.length === 1 ? '' : 's'} to ${targetSession.name}`,
        (meeting) => moveBreakoutParticipantsToSession(
          meeting,
          targetSession,
          selectedParticipants
        )
      );

      if (completed) {
        getParticipantCheckboxes().forEach((checkbox) => {
          checkbox.checked = false;
        });
        updateSelectionControls();
      }

      return completed;
    });
  });

  selectAllCheckbox.addEventListener('change', () => {
    getParticipantCheckboxes().forEach((checkbox) => {
      checkbox.checked = selectAllCheckbox.checked;
    });
    updateSelectionControls();
  });
  container.addEventListener('change', (event) => {
    if (event.target.name === 'breakout-unassigned-participant') {
      updateSelectionControls();
    }
  });

  moveButton.disabled = true;
  moveControls.appendChild(moveButton);
  actions.appendChild(selectAllLabel);
  actions.appendChild(moveControls);
  container.appendChild(actions);

  return container;
}

function createBreakoutParticipantControls(currentMeeting, session, member) {
  const controls = document.createElement('div');

  controls.classList.add('breakout-participant-controls');

  const moveButton = createButton('Move to', () => {
    const sourceSessionId = getBreakoutSessionId(session);
    const options = getBreakoutSessionModels(currentMeeting)
      .filter((targetSession) => getBreakoutSessionId(targetSession) !== sourceSessionId)
      .map((targetSession) => ({
        label: targetSession.name,
        value: targetSession,
      }));

    showBreakoutActionPicker(controls, options, 'Move', (targetSession) =>
      runBreakoutParticipantAction(`Moving ${member.name}`, (meeting) =>
        moveBreakoutParticipantsToSession(meeting, targetSession, [member])
      )
    );
  });
  const exchangeButton = createButton('Exchange', () => {
    const options = getBreakoutExchangeOptions(currentMeeting, session, member);

    showBreakoutActionPicker(controls, options, 'Exchange', ({targetMember, targetSession}) =>
      runBreakoutParticipantAction(
        `Exchanging ${member.name} and ${targetMember.name}`,
        (meeting) => exchangeBreakoutParticipants(
          meeting,
          session,
          member,
          targetSession,
          targetMember
        )
      )
    );
  });
  const removeButton = createButton('Remove', () =>
    runBreakoutParticipantAction(`Removing ${member.name}`, (meeting) =>
      meeting.breakouts.removeFromBreakout([member.id])
    )
  );

  controls.appendChild(moveButton);
  controls.appendChild(exchangeButton);
  controls.appendChild(removeButton);

  return controls;
}

function createBreakoutParticipantsTable(currentMeeting, session, members) {
  const container = document.createElement('div');

  container.classList.add('breakout-participants');

  if (!members.length) {
    container.innerText = 'No participants in this session.';

    return container;
  }

  const table = document.createElement('table');
  const tableHead = document.createElement('thead');
  const tableBody = document.createElement('tbody');
  const headerRow = document.createElement('tr');

  table.classList.add('breakout-participants-table');
  ['Participant', 'Role', 'Actions'].forEach((header) => {
    const headerCell = document.createElement('th');

    headerCell.innerText = header;
    headerRow.appendChild(headerCell);
  });

  members.forEach((member) => {
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    const roleCell = document.createElement('td');
    const controlsCell = document.createElement('td');

    nameCell.innerText = member.name;
    roleCell.innerText = getBreakoutMemberRole(currentMeeting, member);
    controlsCell.appendChild(createBreakoutParticipantControls(currentMeeting, session, member));
    row.appendChild(nameCell);
    row.appendChild(roleCell);
    row.appendChild(controlsCell);
    tableBody.appendChild(row);
  });

  tableHead.appendChild(headerRow);
  table.appendChild(tableHead);
  table.appendChild(tableBody);
  container.appendChild(table);

  return container;
}

function createBreakoutSessionActionButton(currentMeeting, session) {
  const shouldLeave = isBreakoutHostInSession(currentMeeting, session);
  const currentSession = currentMeeting.breakouts.currentBreakoutSession;
  const actionButton = createButton(shouldLeave ? 'Leave' : 'Join', async (button) => {
    button.disabled = true;
    setBreakoutStatus(`${shouldLeave ? 'Leaving' : 'Joining'} ${session.name}...`);

    try {
      if (shouldLeave) {
        await currentSession.leave();
      }
      else {
        await session.join();
      }
      setBreakoutStatus(`${shouldLeave ? 'Leave' : 'Join'} request completed.`);
    }
    catch (error) {
      button.disabled = false;
      setBreakoutStatus(`Unable to ${shouldLeave ? 'leave' : 'join'} ${session.name}.`, true);
      console.error('Breakout#createBreakoutSessionActionButton :: ', error);
    }
  });

  actionButton.disabled = shouldLeave ? typeof currentSession?.leave !== 'function' : typeof session.join !== 'function';

  return actionButton;
}

function startBreakoutSessionRename(currentMeeting, session, nameCell) {
  const originalName = session.name;
  const input = document.createElement('input');
  let isSaving = false;
  let isCancelled = false;

  input.classList.add('breakout-session-name-input');
  input.type = 'text';
  input.value = originalName;
  input.setAttribute('aria-label', `Rename ${originalName}`);
  nameCell.innerHTML = '';
  nameCell.appendChild(input);
  input.focus();
  input.select();

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    }
    else if (event.key === 'Escape') {
      isCancelled = true;
      renderBreakoutSessions(currentMeeting);
    }
  });

  input.addEventListener('blur', async () => {
    if (isSaving || isCancelled) {
      return;
    }

    const updatedName = input.value.trim();

    if (!updatedName) {
      renderBreakoutSessions(currentMeeting);
      setBreakoutStatus('A breakout session name cannot be empty.', true);

      return;
    }

    if (updatedName === originalName) {
      renderBreakoutSessions(currentMeeting);

      return;
    }

    isSaving = true;
    input.disabled = true;
    setBreakoutStatus(`Renaming ${originalName}...`);

    try {
      await updateBreakoutSession(currentMeeting, session, {name: updatedName});
      renderBreakoutSessions(currentMeeting);
      setBreakoutStatus(`${originalName} renamed to ${updatedName}.`);
    }
    catch (error) {
      renderBreakoutSessions(currentMeeting);
      setBreakoutStatus(`Unable to rename ${originalName}. See the console for details.`, true);
      console.error('Breakout#startBreakoutSessionRename :: ', error);
    }
  });
}

function createBreakoutSessionMorePicker(currentMeeting, session, nameCell) {
  const picker = document.createElement('select');
  const moreOption = document.createElement('option');
  const renameOption = document.createElement('option');
  const anyoneCanJoinOption = document.createElement('option');

  picker.classList.add('breakout-session-more');
  picker.setAttribute('aria-label', `More actions for ${session.name}`);
  moreOption.value = '';
  moreOption.text = 'More';
  renameOption.value = 'rename';
  renameOption.text = 'Rename';
  anyoneCanJoinOption.value = 'anyone-can-join';
  anyoneCanJoinOption.text = 'Let anyone join';
  anyoneCanJoinOption.disabled = doesBreakoutSessionAllowAnyone(currentMeeting, session);
  picker.appendChild(moreOption);
  picker.appendChild(renameOption);
  picker.appendChild(anyoneCanJoinOption);

  picker.addEventListener('change', async () => {
    const selectedAction = picker.value;

    picker.value = '';

    if (selectedAction === 'rename') {
      picker.disabled = true;
      startBreakoutSessionRename(currentMeeting, session, nameCell);

      return;
    }

    if (selectedAction !== 'anyone-can-join') {
      return;
    }

    picker.disabled = true;
    setBreakoutStatus(`Allowing anyone to join ${session.name}...`);

    try {
      await updateBreakoutSession(currentMeeting, session, {anyoneCanJoin: true});
      renderBreakoutSessions(currentMeeting);
      setBreakoutStatus(`Anyone can now join ${session.name}.`);
    }
    catch (error) {
      picker.disabled = false;
      setBreakoutStatus(
        `Unable to let anyone join ${session.name}. See the console for details.`,
        true
      );
      console.error('Breakout#createBreakoutSessionMorePicker :: ', error);
    }
  });

  return picker;
}

function getBreakoutBroadcastOptions(role) {
  switch (role) {
    case 'presenters':
      return {presenters: true};
    case 'cohosts':
      return {cohosts: true};
    case 'cohosts-and-presenters':
      return {cohosts: true, presenters: true};
    default:
      return undefined;
  }
}

function createBreakoutBroadcastControls(currentMeeting, sessions) {
  const container = document.createElement('div');
  const title = document.createElement('h3');
  const controls = document.createElement('div');
  const sessionPicker = document.createElement('select');
  const rolePicker = document.createElement('select');
  const messageInput = document.createElement('input');
  const askAllReturnButton = createButton('Ask all return', async (button) => {
    button.disabled = true;
    setBreakoutStatus('Asking all participants to return to the main session...');

    try {
      await currentMeeting.breakouts.askAllToReturn();
      setBreakoutStatus('Return-to-main request sent to all breakout participants.');
    }
    catch (error) {
      setBreakoutStatus(
        'Unable to ask participants to return. See the console for details.',
        true
      );
      console.error('Breakout#createBreakoutBroadcastControls#askAllReturn :: ', error);
    }
    finally {
      button.disabled = false;
    }
  });
  const broadcastButton = createButton('Broadcast', async (button) => {
    const message = messageInput.value.trim();

    if (!message) {
      setBreakoutStatus('Enter a message before broadcasting.', true);
      messageInput.focus();

      return;
    }

    const targetSessionId = sessionPicker.value;
    const options = getBreakoutBroadcastOptions(rolePicker.value);

    button.disabled = true;
    sessionPicker.disabled = true;
    rolePicker.disabled = true;
    messageInput.disabled = true;
    setBreakoutStatus('Broadcasting message...');

    try {
      if (targetSessionId === 'all') {
        await currentMeeting.breakouts.broadcast(message, options);
      }
      else {
        const targetSession = getBreakoutSessionModels(currentMeeting)
          .find((session) => getBreakoutSessionId(session) === targetSessionId);

        if (!targetSession || typeof targetSession.broadcast !== 'function') {
          throw new Error('The selected breakout session is unavailable.');
        }

        await targetSession.broadcast(message, options);
      }

      messageInput.value = '';
      breakoutBroadcastDraft.message = '';
      setBreakoutStatus('Message broadcast completed.');
    }
    catch (error) {
      setBreakoutStatus('Unable to broadcast the message. See the console for details.', true);
      console.error('Breakout#createBreakoutBroadcastControls :: ', error);
    }
    finally {
      button.disabled = false;
      sessionPicker.disabled = false;
      rolePicker.disabled = false;
      messageInput.disabled = false;
    }
  });
  const allSessionsOption = document.createElement('option');
  const roleOptions = [
    {value: 'all', label: 'All participants in session'},
    {value: 'presenters', label: 'All presenters'},
    {value: 'cohosts', label: 'All cohosts'},
    {value: 'cohosts-and-presenters', label: 'All cohosts and presenters'},
  ];
  const addedSessionIds = new Set();

  container.classList.add('breakout-broadcast');
  controls.classList.add('breakout-broadcast-controls');
  title.innerText = 'Broadcast Message';
  allSessionsOption.value = 'all';
  allSessionsOption.text = 'All breakout sessions';
  sessionPicker.setAttribute('aria-label', 'Breakout session recipients');
  sessionPicker.appendChild(allSessionsOption);

  sessions.forEach((session) => {
    const sessionId = getBreakoutSessionId(session);

    if (!sessionId || addedSessionIds.has(sessionId)) {
      return;
    }

    const option = document.createElement('option');

    option.value = sessionId;
    option.text = session.name;
    sessionPicker.appendChild(option);
    addedSessionIds.add(sessionId);
  });

  if (breakoutBroadcastDraft.targetSessionId !== 'all' &&
    !addedSessionIds.has(breakoutBroadcastDraft.targetSessionId)) {
    breakoutBroadcastDraft.targetSessionId = 'all';
  }
  sessionPicker.value = breakoutBroadcastDraft.targetSessionId;
  sessionPicker.addEventListener('change', () => {
    breakoutBroadcastDraft.targetSessionId = sessionPicker.value;
  });

  rolePicker.setAttribute('aria-label', 'Broadcast participant type');
  roleOptions.forEach(({value, label}) => {
    const option = document.createElement('option');

    option.value = value;
    option.text = label;
    rolePicker.appendChild(option);
  });
  rolePicker.value = breakoutBroadcastDraft.role;
  rolePicker.addEventListener('change', () => {
    breakoutBroadcastDraft.role = rolePicker.value;
  });

  messageInput.type = 'text';
  messageInput.placeholder = 'Message';
  messageInput.value = breakoutBroadcastDraft.message;
  messageInput.setAttribute('aria-label', 'Broadcast message');
  messageInput.addEventListener('input', () => {
    breakoutBroadcastDraft.message = messageInput.value;
  });
  messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      broadcastButton.click();
    }
  });

  controls.appendChild(sessionPicker);
  controls.appendChild(rolePicker);
  controls.appendChild(messageInput);
  controls.appendChild(broadcastButton);
  controls.appendChild(askAllReturnButton);
  container.appendChild(title);
  container.appendChild(controls);

  return container;
}

function addBreakoutSession(button) {
  const currentMeeting = getCurrentMeeting();

  if (!currentMeeting || !breakoutSessionConfiguration) {
    setBreakoutStatus('Create the breakout session configuration before adding a session.', true);

    return;
  }

  if (breakoutSessionsCreated || breakoutSessionsStarted) {
    button.disabled = true;
    setBreakoutStatus('Sessions cannot be added after breakout sessions are started. Reset first.', true);

    return;
  }

  const addedSession = {
    name: `Session ${breakoutSessionConfiguration.sessions.length + 1}`,
    anyoneCanJoin: breakoutSessionConfiguration.assignmentMethod === 'choose',
  };

  breakoutSessionConfiguration.sessions.push(addedSession);
  breakoutSessionConfiguration.sessionCount = breakoutSessionConfiguration.sessions.length;
  document.getElementById('breakout-session-count').value =
    breakoutSessionConfiguration.sessionCount;
  renderBreakoutSessions(currentMeeting);
  setBreakoutStatus(
    `${addedSession.name} added to the configuration. It will be created when breakout sessions start.`
  );
}

function renderBreakoutSessions(currentMeeting) {
  const sessions = getBreakoutDisplaySessions(currentMeeting);
  const sessionsHeader = document.createElement('div');
  const title = document.createElement('h3');
  const addSessionButton = createButton('+ Add session', addBreakoutSession, {
    id: 'breakout-add-session',
  });
  const table = document.createElement('table');
  const tableHead = document.createElement('thead');
  const tableBody = document.createElement('tbody');
  const headerRow = document.createElement('tr');
  const headers = ['Name', 'Active', 'Allowed', 'Assigned', 'Assigned Current', 'Requested', 'Controls'];

  sessionsHeader.classList.add('breakout-sessions-header');
  addSessionButton.classList.add('btn-code');
  addSessionButton.disabled = breakoutSessionsCreated || breakoutSessionsStarted;
  title.innerText = 'Breakout Sessions';
  sessionsHeader.appendChild(title);
  sessionsHeader.appendChild(addSessionButton);
  table.classList.add('breakout-sessions-table');

  headers.forEach((header) => {
    const headerCell = document.createElement('th');

    headerCell.innerText = header;
    headerRow.appendChild(headerCell);
  });

  sessions.forEach((session) => {
    const members = getBreakoutSessionMembers(currentMeeting, session);
    const row = document.createElement('tr');
    let nameCell;
    const values = [
      `${session.name} (${members.length})`,
      session.active,
      session.allowed ?? session.anyoneCanJoin,
      session.assigned,
      session.assignedCurrent,
      session.requested,
    ];

    row.classList.add('breakout-session-row');

    values.forEach((value, index) => {
      const cell = document.createElement('td');

      if (index === 0) {
        cell.innerText = value;
        nameCell = cell;
      }
      else {
        const hasValue = Array.isArray(value) ? value.length > 0 : Boolean(value);

        cell.innerText = hasValue ? 'YES' : 'NO';
      }
      row.appendChild(cell);
    });

    const controlsCell = document.createElement('td');
    const controls = document.createElement('div');

    controls.classList.add('breakout-session-controls');

    if (breakoutSessionsStarted) {
      controls.appendChild(createBreakoutSessionActionButton(currentMeeting, session));
      controls.appendChild(
        createBreakoutSessionMorePicker(currentMeeting, session, nameCell)
      );
    }
    else {
      controls.innerText = 'Available after start';
    }

    controlsCell.appendChild(controls);
    row.appendChild(controlsCell);
    tableBody.appendChild(row);

    if (breakoutSessionsStarted) {
      const participantsRow = document.createElement('tr');
      const participantsCell = document.createElement('td');

      participantsRow.classList.add('breakout-participants-row');
      participantsCell.colSpan = headers.length;
      participantsCell.appendChild(createBreakoutParticipantsTable(currentMeeting, session, members));
      participantsRow.appendChild(participantsCell);
      tableBody.appendChild(participantsRow);
    }
  });

  tableHead.appendChild(headerRow);
  table.appendChild(tableHead);
  table.appendChild(tableBody);
  breakoutTableElm.innerHTML = '';

  if (breakoutSessionsStarted) {
    breakoutTableElm.appendChild(
      createBreakoutBroadcastControls(currentMeeting, sessions)
    );
    breakoutTableElm.appendChild(
      createBreakoutUnassignedParticipantsTable(currentMeeting, sessions)
    );
  }
  breakoutTableElm.appendChild(sessionsHeader);
  breakoutTableElm.appendChild(table);
  breakoutTableElm.classList.remove('hidden');
}

function refreshBreakoutSessions() {
  const currentMeeting = getCurrentMeeting();
  const broadcastControls = breakoutTableElm.querySelector('.breakout-broadcast-controls');
  const isRenamingSession = Boolean(
    breakoutTableElm.querySelector('.breakout-session-name-input')
  );
  const isUsingBroadcastControls = broadcastControls?.contains(document.activeElement);

  if (currentMeeting && breakoutSessionsStarted &&
    !isRenamingSession && !isUsingBroadcastControls) {
    renderBreakoutSessions(currentMeeting);
  }
}

async function startBreakoutSessions() {
  const currentMeeting = getCurrentMeeting();

  if (!currentMeeting) {
    setBreakoutStatus('Select and join a meeting before starting breakout sessions.', true);

    return;
  }

  if (!breakoutSessionConfiguration) {
    setBreakoutStatus('Create the breakout session configuration before starting.', true);

    return;
  }

  breakoutStartButtonElm.disabled = true;
  breakoutResetButtonElm.disabled = true;
  const addSessionButton = document.getElementById('breakout-add-session');

  if (addSessionButton) {
    addSessionButton.disabled = true;
  }
  setBreakoutStatus('Creating and starting breakout sessions...');

  try {
    const createResult = await currentMeeting.breakouts.create({
      allowBackToMain: true,
      allowToJoinLater: true,
      delayCloseTime: 60,
      sessions: breakoutSessionConfiguration.sessions,
    });
    let createdGroup = createResult?.body?.groups?.[0];
    let assignedParticipantCount = 0;

    if (!createdGroup?.sessions?.length ||
      createdGroup.sessions.some((session) => !getBreakoutSessionId(session))) {
      const breakoutResult = await currentMeeting.breakouts.getBreakout();

      createdGroup = breakoutResult?.body?.groups?.find((group) => group.status !== 'CLOSED') ||
        breakoutResult?.body?.groups?.[0];
    }

    if (!createdGroup?.id || !createdGroup.sessions?.length) {
      throw new Error('The breakout service did not return the created sessions.');
    }

    breakoutSessionsCreated = true;

    if (breakoutSessionConfiguration.assignmentMethod === 'automatic') {
      const {assignments, participants} = createBreakoutAutomaticAssignments(
        currentMeeting,
        createdGroup.sessions
      );

      if (participants.length) {
        await currentMeeting.breakouts.assign(assignments);
        assignedParticipantCount = participants.length;
      }
    }

    const startResult = await currentMeeting.breakouts.start({
      id: createdGroup.id,
      allowBackToMain: true,
      allowToJoinLater: breakoutSessionConfiguration.assignmentMethod !== 'automatic',
    });
    const startedGroup = startResult?.body?.groups?.[0];
    const sessions = startedGroup?.sessions || createdGroup.sessions || breakoutSessionConfiguration.sessions;

    breakoutSessionConfiguration.sessions = sessions;
    breakoutSessionsStarted = true;
    breakoutCreateButtonElm.disabled = true;
    breakoutResetButtonElm.disabled = false;
    renderBreakoutSessions(currentMeeting);
    currentMeeting.breakouts.queryRosters();
    let assignmentStatus = '';

    if (breakoutSessionConfiguration.assignmentMethod === 'automatic') {
      assignmentStatus = ` ${assignedParticipantCount} participant${assignedParticipantCount === 1 ? '' : 's'} assigned automatically.`;
    }
    else if (breakoutSessionConfiguration.assignmentMethod === 'manual') {
      const {inMeeting, inLobby} = getBreakoutUnassignedParticipants(currentMeeting);
      const unassignedParticipantCount = inMeeting.length + inLobby.length;

      assignmentStatus = ` ${unassignedParticipantCount} eligible participant${unassignedParticipantCount === 1 ? '' : 's'} available under Not Assigned Participants.`;
    }

    setBreakoutStatus(
      `${sessions.length} breakout session${sessions.length === 1 ? '' : 's'} created and started.${assignmentStatus}`
    );
  }
  catch (error) {
    breakoutStartButtonElm.disabled = false;
    breakoutResetButtonElm.disabled = false;

    if (addSessionButton) {
      addSessionButton.disabled = breakoutSessionsCreated;
    }
    setBreakoutStatus('Unable to create and start breakout sessions. See the console for details.', true);
    console.error('Breakout#startBreakoutSessions :: ', error);
  }
}

async function stopScreenShare() {
  console.log('MeetingControls#stopScreenShare()');
  try {
    if (localMedia.screenShare.audio) {
      localMedia.screenShare.audio?.stop();
    }
    if (localMedia.screenShare.video) {
      localMedia.screenShare.video?.stop();
    }

    console.log('MeetingControls#stopScreenShare() :: Successfully stopped sharing!');
  }
  catch (error) {
    console.log('MeetingControls#stopScreenShare() :: Error stopping screen share!');
    console.error(error);
  }
}

async function toggleBrb({unmuteAudio = false, unmuteVideo = false}) {
  const meeting = getCurrentMeeting();

  if (meeting) {
    const brbButton = document.getElementById('brb-btn');
    const enableBrb = brbButton.innerText === 'Step away';

    try {
      isBrb = enableBrb;

      if (enableBrb) {
        localMediaCameraMuted = localMedia.cameraStream?.userMuted;
        localMediaMicMuted = localMedia.microphoneStream?.userMuted;

        // stop sharing and disable buttons to use it in brb
        await stopScreenShare();
        publishShareBtn.disabled = true;
        unpublishShareBtn.disabled = true;
        startShareBtn.disabled = true;
        handleBrbShareMessage(true);

        localMedia.cameraStream?.setUserMuted(true);
        localMedia.microphoneStream?.setUserMuted(true);
      } else {
        if (unmuteAudio) {
          localMedia.microphoneStream.setUserMuted(false);
          localMediaCameraMuted = undefined;
          localMediaMicMuted = undefined;
        }

        if (unmuteVideo) {
          localMedia.cameraStream.setUserMuted(false);
          localMediaCameraMuted = undefined;
          localMediaMicMuted = undefined;
        }

        if (localMediaCameraMuted !== undefined && localMediaMicMuted !== undefined) {
          localMedia.cameraStream.setUserMuted(localMediaCameraMuted);
          localMedia.microphoneStream.setUserMuted(localMediaMicMuted);
        }

        // restore user sharing buttons
        publishShareBtn.disabled = false;
        unpublishShareBtn.disabled = false;
        startShareBtn.disabled = false;
        handleBrbShareMessage(false);
      }

      const result = await meeting.beRightBack(enableBrb);

      console.log(`meeting.beRightBack(${enableBrb}): success. Result: ${result}`);
    } catch (error) {
      console.error(`meeting.beRightBack({${enableBrb}): error: `, error);
    }
  }
}

const createAdmitDiv = () => {

  const containerDiv = document.createElement('div');
  let boSelector = null;

  if (meeting.breakouts.currentBreakoutSession && meeting.breakouts.breakouts.length) {
    boSelector = document.createElement('select');
    boSelector.style.display = 'inline-block';
    const allSession = document.createElement('option');
    allSession.text = 'Main meeting';
    boSelector.appendChild(allSession);
    const breakoutSession = meeting.breakouts.currentBreakoutSession;
    if (breakoutSession.isMain) {
      allSession.value = "Main";
    } else {
      const option = document.createElement('option');
      option.value = breakoutSession.sessionId;
      option.text = breakoutSession.name;
      boSelector.appendChild(option);
    }
    meeting.breakouts.breakouts.forEach((breakoutSession) => {
      if (breakoutSession.isMain) {
        allSession.value = "Main";
        return;
      }
      const option = document.createElement('option');
      option.value = breakoutSession.sessionId;
      option.text = breakoutSession.name;
      boSelector.appendChild(option);
    })
  }

  const button = document.createElement('button');
  button.innerText = 'Admit';

  button.onclick = () => {
    function admitMemberToMin(participant) {
      const meeting = getCurrentMeeting();
      if (meeting) {
        meeting.admit([participant]).then((res) => {
          console.log(res, 'participant has been admitted');
        }).catch((err) => {
          console.log('unable to admit participant', err);
        });
      }
    }

    function admitMemberToBreakout(participant, boId) {
      const meeting = getCurrentMeeting();
      if (meeting) {
        meeting.breakouts.dynamicAssign([{
          id: boId,
          participants: [participant],
          targetState: "JOINED",
        }]).then((res) => {
          console.log(res, 'participant has been admitted');
        }).catch((err) => {
          console.log('unable to admit participant', err);
        });
      }
    }

    const participantID = getRadioValue('participant-select');
    const targetBo = boSelector?.value;

    if (!targetBo || targetBo === 'Main') {
      admitMemberToMin(participantID);
    } else {
      admitMemberToBreakout(participantID, targetBo);
    }
  };

  if (boSelector) {
    containerDiv.appendChild(boSelector);
  }
  containerDiv.appendChild(button);

  return containerDiv;
};
function createMembersTable(members) {
  function createLabel(id, value = '') {
    const label = document.createElement('label');

    label.innerText = value;
    label.setAttribute('for', id);

    return label;
  }

  function createHeadRow() {
    const tr = document.createElement('tr');
    const th1 = document.createElement('th');
    const th2 = document.createElement('th');
    const th3 = document.createElement('th');
    const th4 = document.createElement('th');
    const th5 = document.createElement('th');
    const th6 = document.createElement('th');

    th1.innerText = 'NAME';
    th2.innerText = 'VIDEO';
    th3.innerText = 'AUDIO';
    th4.innerText = 'STATUS';
    th5.innerText = 'SUPPORTS BREAKOUTS';
    th6.innerText = 'AWAY';

    tr.appendChild(th1);
    tr.appendChild(th2);
    tr.appendChild(th3);
    tr.appendChild(th4);
    tr.appendChild(th5);
    tr.appendChild(th6);

    return tr;
  }

  function createRow(member) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');
    const td3 = document.createElement('td');
    const td4 = document.createElement('td');
    const td5 = document.createElement('td');
    const td6 = document.createElement('td');
    const label1 = createLabel(member.id);
    const label2 = createLabel(member.id, member.isVideoMuted ? 'NO' : 'YES');
    const label3 = createLabel(member.id, member.isAudioMuted ? 'NO' : 'YES');
    const label4 = createLabel(member.id, member.status);
    const label5 = createLabel(member.id, member.supportsBreakouts ? 'YES' : 'NO');

    const radio = document.createElement('input');

    radio.type = 'radio';
    radio.id = member.id;
    radio.value = member.id;
    radio.name = 'participant-select';

    label1.appendChild(radio);
    label1.innerHTML = label1.innerHTML.concat(member.name);

    td1.appendChild(label1);
    td2.appendChild(label2);
    td3.appendChild(label3);

    if (member.isInLobby) {
      td4.appendChild(createAdmitDiv());
    } else {
      td4.appendChild(label4);
    }

    td5.appendChild(label5);


    if (isMemberSelf(member) && member.isInMeeting) {
      td6.appendChild(createButton(member.isBrb ? 'Back to meeting' : 'Step away', toggleBrb, {id: 'brb-btn'}));
    } else {
      td6.appendChild(createLabel(member.id, member.isBrb ? 'YES' : 'NO'));
    }

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
    tr.appendChild(td6);

    return tr;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  thead.appendChild(createHeadRow());

  Object.entries(members).forEach(([_, value]) => {
    if (value.status !== 'NOT_IN_MEETING') {
      const row = createRow(value);

      tbody.appendChild(row);
    }
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  return table;
};
function viewParticipants() {
  const meeting = getCurrentMeeting();

  if (meeting) {
    emptyParticipants();
    const {members} = meeting.members.membersCollection;

    participantTable.appendChild(createMembersTable(members));

    const btnDiv = document.createElement('div');

    btnDiv.classList.add('btn-group');

    btnDiv.appendChild(createButton('Mute', muteMember, {id: 'mute-participant-btn'}));
    btnDiv.appendChild(createButton('Remove', removeMember));
    btnDiv.appendChild(createButton('Make Host', transferHostToMember));

    participantButtons.appendChild(btnDiv);

    const inviteDiv = document.createElement('div');
    const inviteInput = document.createElement('input');
    const inviteBtn = createButton('Invite', inviteMember);

    inviteDiv.style.display = 'flex';

    inviteInput.type = 'text';
    inviteInput.placeholder = 'Invite Member';

    inviteDiv.appendChild(inviteInput);
    inviteDiv.appendChild(inviteBtn);

    participantButtons.appendChild(inviteDiv);
  }
}

function emptyParticipants() {
  participantTable.innerText = '';
  participantButtons.innerText = '';
}

/* ANSWER/REJECT INCOMING CALL */

function toggleDisplay(elementId, status) {
  const element = document.getElementById(elementId);

  if (status) {
    element.classList.remove('hidden');
  }
  else {
    element.classList.add('hidden');
  }
}

function answerMeeting() {
  let meeting;
  webex.meetings.syncMeetings()
    .then(() => {
      const meetings = webex.meetings.getAllMeetings();
      const meetingIds = Object.keys(meetings);
      for (let i = 0; i < meetingIds.length; i += 1) {
        if (meetings[meetingIds[i]].destination.info.locusTags[0] === 'ONE_ON_ONE') {
            meeting = meetings[meetingIds[i]];
            selectedMeetingId = meetingIds[i];
            break;
        }
      }

      if (meeting) {
        clearMediaDeviceList();

        const mediaSettings = getMediaSettings()

        getUserMedia({
          audio: mediaSettings.audioEnabled,
          video: mediaSettings.videoEnabled
        }).then(() => {
          doPreMediaSetup(meeting);

          // we're using the default RemoteMediaManagerConfig
          const mediaOptions = {
            localStreams: {
              microphone: localMedia.microphoneStream,
              camera: localMedia.cameraStream,
              screenShare: {
                audio: localMedia.screenShare?.audio,
                video: localMedia.screenShare?.video
              }
            },
            ...getMediaSettings()
          };

          const joinOptions = {
            isMultistream: false,
          };

          meeting.joinWithMedia({joinOptions, mediaOptions})
            .then(() => {
              doPostMediaSetup(meeting);
              meeting.acknowledge('INCOMING')
                .then(() => {
                  toggleDisplay('incomingsection', false);
                  updateMeetingInfoSection(meeting);
                });
            });
        });
      } else {
        console.log('No meeting found');
      }
  })
  .catch(error => console.log('Error occurred while answering meeting', error));
}

function rejectMeeting() {
  const meeting = getCurrentMeeting();

  if (meeting) {
    meeting.decline('BUSY');
    toggleDisplay('incomingsection', false);
  }
}

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
  addPlayIfPausedEvents(htmlMediaElements);
  updateMultistreamUI();
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

function enableMeetingDependentButtons(enable) {
  const meetingDependentButtons = document.querySelectorAll('.meeting-dependent');

  meetingDependentButtons.forEach((button) => {
    button.disabled = !enable;
  });

  // Update SIP call-out button states when meeting state changes
  validateSipCalloutFields();
  validateCancelSipFields();
}

enableMeetingDependentButtons(false);

// Simultaneous Interpretation Section ------------------------------------------

const siStatusElm = document.querySelector('#si-status');
const siOutputElm = document.querySelector('#si-output');
const siSourceLanguageElm = document.querySelector('#si-source-language');
const siTargetLanguageElm = document.querySelector('#si-target-language');
const siParticipantIdElm = document.querySelector('#si-participant-id');
const siEmailElm = document.querySelector('#si-email');

/**
 * Fetches the current list of interpreters assigned to this meeting.
 *
 * The response contains interpreter objects with participantId, emailAddress,
 * sourceLanguage, targetLanguage, etc.
 *
 * Note: the shape returned by getInterpreters() is NOT the same shape expected
 * by updateInterpreters().
 */
function siGetInterpreters() {
  const meeting = getCurrentMeeting();

  if (!meeting) {
    console.log('SI#getInterpreters() :: no active meeting');
    return;
  }

  siStatusElm.innerText = 'Fetching interpreters...';
  console.log('SI#getInterpreters()');

  meeting.simultaneousInterpretation.getInterpreters()
    .then((response) => {
      const interpreters = response.body?.interpreters || [];
      siStatusElm.innerText = `Found ${interpreters.length} interpreter(s)`;
      siOutputElm.textContent = JSON.stringify(interpreters, null, 2);
      console.log('SI#getInterpreters() :: success', interpreters);
    })
    .catch((error) => {
      siStatusElm.innerText = 'Error! See console for details.';
      console.error('SI#getInterpreters() :: failed', error);
    });
}

/**
 * Fetches the list of languages available for interpretation in this meeting.
 *
 * Note: querySupportLanguages() resolves with void — internally it stores the
 * result on `simultaneousInterpretation.supportLanguages` and emits a
 * SUPPORT_LANGUAGES_UPDATE event, so callers read the value from the property
 * rather than the promise.
 */
function siGetSupportLanguages() {
  const meeting = getCurrentMeeting();

  if (!meeting) {
    console.log('SI#getSupportLanguages() :: no active meeting');
    return;
  }

  siStatusElm.innerText = 'Fetching support languages...';
  console.log('SI#getSupportLanguages()');

  meeting.simultaneousInterpretation.querySupportLanguages()
    .then(() => {
      const languages = meeting.simultaneousInterpretation.supportLanguages || [];
      siStatusElm.innerText = `Found ${languages.length} language(s)`;
      siOutputElm.textContent = JSON.stringify(languages, null, 2);
      console.log('SI#getSupportLanguages() :: success', languages);
    })
    .catch((error) => {
      siStatusElm.innerText = 'Error! See console for details.';
      console.error('SI#getSupportLanguages() :: failed', error);
    });
}

/**
 * Updates the interpreters for this meeting.
 *
 * IMPORTANT: The payload format for updateInterpreters requires a
 * "usingResource" object containing the interpreter's participant ID (and
 * optionally their email). This is different from the flat structure returned
 * by getInterpreters().
 *
 * Expected payload format:
 * ```
 *   [{
 *     order: 0,
 *     sourceLanguage: "en",
 *     targetLanguage: "fr",
 *     usingResource: { id: "<participantId>", email: "<optional-email>" }
 *   }]
 * ```
 */
function siUpdateInterpreters() {
  const meeting = getCurrentMeeting();

  if (!meeting) {
    console.log('SI#updateInterpreters() :: no active meeting');
    return;
  }

  const sourceLanguage = siSourceLanguageElm.value.trim();
  const targetLanguage = siTargetLanguageElm.value.trim();
  const participantId = siParticipantIdElm.value.trim();
  const email = siEmailElm.value.trim();

  if (!sourceLanguage || !targetLanguage || !participantId) {
    siStatusElm.innerText = 'Please fill in source language, target language, and participant ID.';
    return;
  }

  // Build the interpreter object in the format the Locus API expects.
  // The key field is "usingResource" which identifies the interpreter participant.
  const interpreter = {
    order: 0,
    sourceLanguage,
    targetLanguage,
    usingResource: {
      id: participantId,
      ...(email && {email}),
    },
  };

  siStatusElm.innerText = 'Updating interpreters...';
  siOutputElm.textContent = `Sending:\n${JSON.stringify([interpreter], null, 2)}`;
  console.log('SI#updateInterpreters()', [interpreter]);

  meeting.simultaneousInterpretation.updateInterpreters([interpreter])
    .then((response) => {
      siStatusElm.innerText = 'Interpreters updated successfully!';
      console.log('SI#updateInterpreters() :: success', response);
    })
    .catch((error) => {
      siStatusElm.innerText = 'Error! See console for details.';
      console.error('SI#updateInterpreters() :: failed', error);
    });
}

// -------------------------------------------------------------------------------

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
