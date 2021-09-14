/* eslint-env browser */

/* global Webex */

/* eslint-disable camelcase */
/* eslint-disable max-nested-callbacks */
/* eslint-disable no-alert */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */
/* eslint-disable arrow-body-style */
/* eslint-disable max-len */


let activeMeeting;
let remoteShareStream;
let isToken;
let isOAuth;
let webex;
// This is one way you might programattically determine your redirect_uri
// depending on where you've deployed your app, but you're probably better off
// having development/staging/production builds and injecting directly from the
// environment.
let redirect_uri;

// OAuth section

// Initialize Webex to authorize through OAuth
function initializeWebexOAuthVersion() {
  // eslint-disable-next-line no-multi-assign
  redirect_uri = `${window.location.protocol}//${window.location.host}`;

  if (window.location.pathname) {
    redirect_uri += window.location.pathname;
  }

  webex = window.webex = Webex.init({
    config: {
      logger: {
        level: 'debug'
      },
      meetings: {
        reconnection: {
          enabled: true
        }
      },
      // Any other sdk config we need
      credentials: {
        client_id: 'C7c3f1143a552d88d40b2afff87600c366c830850231597fb6c1c1e28a5110a4f',
        redirect_uri,
        scope: 'spark:all spark:kms'
      }
    }
  });
}

// Creates OAuth Form
function displayOAuthForm() {
  // Present and hide correct form
  document.getElementById('token-auth').style.display = 'none';
  document.getElementById('oauth').style.display = 'block';

  // Now, we adding event handler to login button to initiate login when clicked
  document.getElementById('login').addEventListener('click', (event) => {
    // Let's make sure we don't reload the page when we submit the form
    event.preventDefault();

    // Initialize the Webex
    initializeWebexOAuthVersion();


    // Initiate login to Webex account
    webex.authorization.initiateLogin();
  });

  // Now, we adding event handler to login out button to initiate login out when clicked
  document.getElementById('logout').addEventListener('click', (event) => {
    // Let's make sure we don't reload the page when we submit the form
    event.preventDefault();

    // Redirects user to sign out page
    webex.logout();
  });
}

// Token Section
function initializeWebexTokenVersion() {
  // eslint-disable-next-line no-multi-assign
  webex = window.webex = Webex.init({
    config: {
      logger: {
        level: 'debug'
      },
      meetings: {
        reconnection: {
          enabled: true
        }
      }
      // Any other sdk config we need
    },

    credentials: {
      access_token: document.getElementById('access-token').value
    }
  });


  document.getElementById('webex-status').innerText = 'webex is initialized';
  document.getElementById('webexInit').disabled = true;
}

// Initialize Webex to authorize through pasting access token
function displayTokenForm() {
  // Present and hide correct form
  document.getElementById('token-auth').style.display = 'block';
  document.getElementById('oauth').style.display = 'none';

  // Let's wire our form fields up to localStorage so we don't have to
  // retype things everytime we reload the page.
  [
    'access-token'
  ].forEach((id) => {
    const el = document.getElementById(id);

    el.value = localStorage.getItem(id);
    el.addEventListener('change', (event) => {
      localStorage.setItem(id, event.target.value);
    });
  });

  // Adding event handler for webex.init() button to initiaze a different webex instance
  document.getElementById('webexInit').addEventListener('click', (event) => {
    // let's make sure we don't reload the page when we want to initialize webex
    event.preventDefault();

    // Create webex instance
    initializeWebexTokenVersion();

    listenForIncomingMeetings();

    // Disabled selecting auth options and enabled register button
    document.getElementById('register').disabled = false;
    document.getElementById('auth-type').disabled = true;
  });

  // Add event handlers to the media buttons
  createEventListenerForMediaButtons();
}

// The function is called when selecting the auth type in the form
// and presenting the correct form associated with the selected auth type
function handleAuthTypeChange() {
  // Checks which radio is selected
  isToken = document.getElementById('token-input').checked;
  isOAuth = document.getElementById('oauth-input').checked;

  // We would like to add the correct form based on the selected radio
  if (isOAuth) {
    displayOAuthForm();
  }

  if (isToken) {
    displayTokenForm();
  }
}

/**
 * The following functions handle the meeting SDK specifically.
 * We are wiring up actions to buttons to perform meeting functions when clicked.
 * We are also listening and responding to events fired by the SDK.
 */

// Event Handlers for Call controls and dialer
function createEventListenerForMediaButtons() {
  // Adding event handler for share screen button to share device's screen
  document.getElementById('share-screen').addEventListener('click', () => {
    if (activeMeeting) {
    // First check if we can update
      waitForMediaReady(activeMeeting).then(() => {
        console.info('SHARE-SCREEN: Sharing screen via `shareScreen()`');
        activeMeeting.shareScreen()
          .then(() => {
            console.info('SHARE-SCREEN: Screen successfully added to meeting.');
          })
          .catch((e) => {
            console.error('SHARE-SCREEN: Unable to share screen, error:');
            console.error(e);
          });
      });
    }
    else {
      console.error('No active meeting available to share screen.');
    }
  });

  // Adding event handler for stop-screen-share button to stop sharing device's screen
  document.getElementById('stop-screen-share').addEventListener('click', () => {
    if (activeMeeting) {
    // First check if we can update, if not, wait and retry
      waitForMediaReady(activeMeeting).then(() => {
        activeMeeting.stopShare();
      });
    }
  });

  // Adding event handler for dial button to dial a call
  document.getElementById('dial').addEventListener('click', (event) => {
  // again, we don't want to reload when we try to dial
    event.preventDefault();

    const destination = document.getElementById('invitee').value;

    // we'll use `listenForIncomingMeetings()` (even though we might already be connected or
    // connecting) to make sure we've got a functional webex instance.
    listenForIncomingMeetings().then(() => {
      // Create the meeting
      return webex.meetings.create(destination).then((meeting) => {
        // Pass the meeting to our join meeting helper
        return joinMeeting(meeting);
      });
    })
      .catch((error) => {
        // Report the error
        console.error(error);

        // Implement error handling here
      });
  });

  // Adding event handler for register button to register the device
  document.getElementById('register').addEventListener('click', (event) => {
    // again, we don't want to reload when we try to register
    event.preventDefault();

    // Register our device with Webex cloud
    if (!webex.meetings.registered) {
      webex.meetings.register()
        // Sync our meetings with existing meetings on the server
        .then(() => webex.meetings.syncMeetings())
        .then(() => {
          // This is just a little helper for our selenium tests and doesn't
          // really matter for the example
          document.body.classList.add('listening');
          document.getElementById('register-status').innerText = 'device is registered';
          enableMeetingActionButtons();
        })
        // This is a terrible way to handle errors, but anything more specific is
        // going to depend a lot on your app
        .catch((err) => {
          console.log('error in connection');

          // We'll rethrow here since we didn't really *handle* the error, we just
          // reported it
          throw err;
        });
    }
  });

  //  Adding event handler for unregister button to unregister the device
  document.getElementById('unregister').addEventListener('click', (event) => {
    // again, we don't want to reload when we try to register
    event.preventDefault();

    webex.meetings.unregister();
    disableMeetingActionButtons();
    document.getElementById('register').disabled = false;
    document.getElementById('register-status').innerText = 'device is not registered';
    document.getElementById('auth-type').disabled = false;
  });
}

// There's a few different events that'll let us know that we need to start listening
// for incoming calls, so we'll wrap a few things up in a function.
function listenForIncomingMeetings() {
  return new Promise((resolve) => {
    // Listen for added meetings
    webex.meetings.on('meeting:added', (addedMeetingEvent) => {
      if (addedMeetingEvent.type === 'INCOMING') {
        const addedMeeting = addedMeetingEvent.meeting;

        // Acknowledge to the server that we received the call on our device
        addedMeeting.acknowledge(addedMeetingEvent.type)
          .then(() => {
            if (confirm('Answer incoming call')) {
              joinMeeting(addedMeeting);
            }
            else {
              addedMeeting.decline();
            }
          });
      }
    });
    resolve();
  });
}

// Similarly, there are a few different ways we'll get a meeting Object, so let's
// put meeting handling inside its own function.
function bindMeetingEvents(meeting) {
  // Meeting is a meeting instance, not a promise, so to know if things break,
  // we'll need to listen for the error event. Again, this is a rather naive
  // handler.
  meeting.on('error', (err) => {
    console.error(err);
  });

  meeting.on('meeting:startedSharingRemote', () => {
    // Set the source of the video element to the previously stored stream
    document.getElementById('remote-screen').srcObject = remoteShareStream;
    document.getElementById('screenshare-tracks-remote').innerText = 'SHARING';
  });

  meeting.on('meeting:stoppedSharingRemote', () => {
    document.getElementById('remote-screen').srcObject = null;
    document.getElementById('screenshare-tracks-remote').innerText = 'STOPPED';
  });

  // Handle media streams changes to ready state
  meeting.on('media:ready', (media) => {
    if (!media) {
      return;
    }
    console.log(`MEDIA:READY type:${media.type}`);
    if (media.type === 'local') {
      document.getElementById('self-view').srcObject = media.stream;
    }
    if (media.type === 'remoteVideo') {
      document.getElementById('remote-view-video').srcObject = media.stream;
    }
    if (media.type === 'remoteAudio') {
      document.getElementById('remote-view-audio').srcObject = media.stream;
    }
    if (media.type === 'remoteShare') {
      // Remote share streams become active immediately on join, even if nothing is being shared
      remoteShareStream = media.stream;
    }
    if (media.type === 'localShare') {
      document.getElementById('self-screen').srcObject = media.stream;
    }
  });

  // Handle media streams stopping
  meeting.on('media:stopped', (media) => {
    // Remove media streams
    if (media.type === 'local') {
      document.getElementById('self-view').srcObject = null;
    }
    if (media.type === 'remoteVideo') {
      document.getElementById('remote-view-video').srcObject = null;
    }
    if (media.type === 'remoteAudio') {
      document.getElementById('remote-view-audio').srcObject = null;
    }
    if (media.type === 'localShare') {
      document.getElementById('self-screen').srcObject = null;
    }
  });

  // Handle share specific events
  meeting.on('meeting:startedSharingLocal', () => {
    document.getElementById('screenshare-tracks').innerText = 'SHARING';
  });
  meeting.on('meeting:stoppedSharingLocal', () => {
    document.getElementById('screenshare-tracks').innerText = 'STOPPED';
  });

  // Update participant info
  meeting.members.on('members:update', (delta) => {
    const {full: membersData} = delta;
    const memberIDs = Object.keys(membersData);

    memberIDs.forEach((memberID) => {
      const memberObject = membersData[memberID];

      // Devices are listed in the memberships object.
      // We are not concerned with them in this demo
      if (memberObject.isUser) {
        if (memberObject.isSelf) {
          document.getElementById('call-status-local').innerText = memberObject.status;
        }
        else {
          document.getElementById('call-status-remote').innerText = memberObject.status;
        }
      }
    });
  });

  // Of course, we'd also like to be able to end the meeting:
  const leaveMeeting = () => meeting.leave();

  document.getElementById('hangup').addEventListener('click', leaveMeeting, {once: true});

  meeting.on('all', (event) => {
    console.log(event);
  });
}

// Waits for the meeting to be media update ready
function waitForMediaReady(meeting) {
  return new Promise((resolve, reject) => {
    if (meeting.canUpdateMedia()) {
      resolve();
    }
    else {
      console.info('SHARE-SCREEN: Unable to update media, pausing to retry...');
      let retryAttempts = 0;

      const retryInterval = setInterval(() => {
        retryAttempts += 1;
        console.info('SHARE-SCREEN: Retry update media check');

        if (meeting.canUpdateMedia()) {
          console.info('SHARE-SCREEN: Able to update media, continuing');
          clearInterval(retryInterval);
          resolve();
        }
        // If we can't update our media after 15 seconds, something went wrong
        else if (retryAttempts > 15) {
          console.error('SHARE-SCREEN: Unable to share screen, media was not able to update.');
          clearInterval(retryInterval);
          reject();
        }
      }, 10000);
    }
  });
}

// Join the meeting and add media
function joinMeeting(meeting) {
  // Save meeting to global object
  activeMeeting = meeting;

  // Call our helper function for binding events to meetings
  bindMeetingEvents(meeting);

  return meeting.join().then(() => {
    const mediaSettings = {
      receiveVideo: true,
      receiveAudio: true,
      receiveShare: true,
      sendVideo: true,
      sendAudio: true,
      sendShare: false
    };

    return meeting.getMediaStreams(mediaSettings).then((mediaStreams) => {
      const [localStream, localShare] = mediaStreams;

      meeting.addMedia({
        localShare,
        localStream,
        mediaSettings
      });
    });
  });
}

// Function called to enable meeting buttons after registering a device
function enableMeetingActionButtons() {
  document.getElementById('call-controls').disabled = false;
  document.getElementById('dialer').disabled = false;
  document.getElementById('register').disabled = true;
  document.getElementById('unregister').disabled = false;
}

// Function called to disable meeting buttons after unregistering a device
function disableMeetingActionButtons() {
  document.getElementById('call-controls').disabled = true;
  document.getElementById('invitee').disabled = true;
  document.getElementById('dialer').disabled = true;
  document.getElementById('register').disabled = true;
  document.getElementById('unregister').disabled = true;
}

// Checks if we are returning from oauth
if (window.location.hash) {
  // Hash is created which gives us the access token,
  // which will be used in the SDK initialization process
  initializeWebexOAuthVersion();

  // Immediately enabled all button in the oauth section when Webex is ready to be used
  webex.once('ready', () => {
    if (webex.canAuthorize && isOAuth) {
      document.getElementById('login-status').innerText = 'login completed';
      document.getElementById('register').disabled = false;
      document.getElementById('logout').disabled = false;
      document.getElementById('login').disabled = true;
      document.getElementById('auth-type').disabled = true;
      listenForIncomingMeetings();
      // Add event handlers to the media buttons
      createEventListenerForMediaButtons();
    }
  });
}

// Checks which radio is enabled and what to display back to the user
handleAuthTypeChange();

