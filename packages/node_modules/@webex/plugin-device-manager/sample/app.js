/* eslint-env browser */

/* global Webex */

/* eslint-disable camelcase */
/* eslint-disable max-nested-callbacks */
/* eslint-disable no-alert */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */

// Declare some globals that we'll need throughout
let webex;
// First, let's wire our form fields up to localStorage so we don't have to
// retype things everytime we reload the page.

[
  'access-token'
  // 'invitee'
].forEach((id) => {
  const el = document.getElementById(id);

  el.value = localStorage.getItem(id);
  el.addEventListener('change', (event) => {
    localStorage.setItem(id, event.target.value);
  });
});

function connect() {
  if (!webex) {
    webex = Webex.init({
      config: {
        // Any other sdk config we need
      },
      credentials: {
        access_token: document.getElementById('access-token').value
      }
    });
  }

  if (!webex.internal.device.registered) {
    webex.internal.device
      .register()
      .then(() => {
        // This is just a little helper for our selenium tests and doesn't
        // really matter for the example
        document.body.classList.add('listening');
        document.getElementById('connection-status').innerHTML = 'connected';

        // return this.webex.internal.device.register()
        return webex.internal.mercury.connect();
      })
      // This is a terrible way to handle errors, but anything more specific is
      // going to depend a lot on your app
      .catch((err) => {
        console.error(err);
        // we'll rethrow here since we didn't really *handle* the error, we just
        // reported it
        throw err;
      });
  }
}

function requestPinChallenge(deviceId) {
  return webex.devicemanager.requestPin({id: deviceId})
    .then(() => {
      toggleDisplay('enterPinDiv', true);
      toggleDisplay('requestPairingBtnDiv', true);
      notify('Enter the PIN');
    });
}


document.getElementById('deviceControls').refresh.addEventListener('click', () => {
  if (webex.devicemanager) {
    notify('Listing devices...');

    return webex.devicemanager.refresh()
      .then((devices) => {
        populateDeviceDropdown(devices);
        notify('');
        toggleDisplay('requestPinDiv', true);
        toggleDisplay('removeBtnDiv', true);
      });
  }

  return false;
});

// when PIN is requested
document.getElementById('requestPin').addEventListener('click', () => {
  if (webex.devicemanager) {
    notify('Requesting Pin...');
    const dropdown = document.getElementById('device-list-dropdown');
    const deviceId = dropdown.options[dropdown.selectedIndex].value;

    if (deviceId && deviceId !== 'Choose a Device') {
      return requestPinChallenge(deviceId);
    }
    notify('Select a device first');
  }

  return false;
});

// when device pairing is requested
document.getElementById('requestPairing').addEventListener('click', () => {
  if (webex.devicemanager) {
    notify('Pairing...');
    const pin = document.getElementById('pin').value;

    return webex.devicemanager.pair({pin})
      .then(() => {
        notify('Paired');
        toggleDisplay('requestUnPairingBtnDiv', true);
        toggleDisplay('getAudioStateBtnDiv', true);
        toggleDisplay('volumeUpBtnDiv', true);
        toggleDisplay('volumeDownBtnDiv', true);
        toggleDisplay('muteBtnDiv', true);
        toggleDisplay('enterConvoIdDiv', true);
        toggleDisplay('bindSpaceBtnDiv', true);
      })
      .then(() => webex.devicemanager.refresh())
      .then((devices) => {
        populateDeviceDropdown(devices);
        notify('');
        toggleDisplay('requestPinDiv', true);
        toggleDisplay('removeBtnDiv', true);
      })
      .catch(() => {
        notify('Incorrect PIN');
      });
  }

  return false;
});

// when device unpairing is requested
document.getElementById('requestUnPairing').addEventListener('click', () => {
  if (webex.devicemanager) {
    notify('UnPairing...');

    return webex.devicemanager.unpair()
      .then(() => {
        notify('UnPaired');
        toggleDisplay('requestUnPairingBtnDiv', false);
        toggleDisplay('requestPairingBtnDiv', false);
        toggleDisplay('enterPinDiv', false);
        toggleDisplay('getAudioStateBtnDiv', false);
        toggleDisplay('hideAudioStateBtnDiv', false);
        toggleDisplay('getAudioStateContentsDiv', false);
        toggleDisplay('volumeUpBtnDiv', false);
        toggleDisplay('volumeDownBtnDiv', false);
        toggleDisplay('muteBtnDiv', false);
        toggleDisplay('unmuteBtnDiv', false);
        toggleDisplay('enterConvoIdDiv', false);
        toggleDisplay('bindSpaceBtnDiv', false);
        toggleDisplay('unbindSpaceBtnDiv', false);
      });
  }

  return false;
});

// getAudioState of the paired device
document.getElementById('getAudioState').addEventListener('click', () => {
  if (webex.devicemanager) {
    notify('GettingAudioState...');

    return webex.devicemanager.getAudioState()
      .then((res) => {
        populateDeviceAudioState(res);
        notify('Audio State fetched');
      });
  }

  return false;
});

// increase volume of paired device
document.getElementById('volumeUp').addEventListener('click', () => {
  if (webex.devicemanager) {
    notify('Increasing Volume...');

    return webex.devicemanager.increaseVolume()
      .then(() => webex.devicemanager.getAudioState())
      .then((res) => {
        populateDeviceAudioState(res);
        notify('Volume Increased');
      });
  }

  return false;
});

// increase volume of paired device
document.getElementById('volumeDown').addEventListener('click', () => {
  if (webex.devicemanager) {
    notify('Decreasing Volume...');

    return webex.devicemanager.decreaseVolume()
      .then(() => webex.devicemanager.getAudioState())
      .then((res) => {
        populateDeviceAudioState(res);
        notify('Volume Decreased');
      });
  }

  return false;
});

// mute paired device
document.getElementById('mute').addEventListener('click', () => {
  if (webex.devicemanager) {
    notify('Muting...');

    return webex.devicemanager.mute()
      .then(() => webex.devicemanager.getAudioState())
      .then((res) => {
        populateDeviceAudioState(res);
        notify('Muted');
        toggleDisplay('muteBtnDiv', false);
        toggleDisplay('unmuteBtnDiv', true);
      });
  }

  return false;
});

// unmute paired device
document.getElementById('unmute').addEventListener('click', () => {
  if (webex.devicemanager) {
    notify('UnMuting');

    return webex.devicemanager.unmute()
      .then(() => webex.devicemanager.getAudioState())
      .then((res) => {
        populateDeviceAudioState(res);
        notify('Unmuted');
        toggleDisplay('muteBtnDiv', true);
        toggleDisplay('unmuteBtnDiv', false);
      });
  }

  return false;
});

// when bindSpace is requested
document.getElementById('bindSpace').addEventListener('click', () => {
  if (webex.devicemanager) {
    notify('Binding space...');
    const convoId = document.getElementById('convoId').value;
    let url;

    return webex.internal.services.waitForCatalog('postauth')
      .then(() => {
        url = `${webex.internal.services.get('conversation')}/conversations/${convoId}`;

        return webex.internal.conversation.get({url}, {
          url,
          includeUxTimers: true,
          ackFilter: 'noack',
          includeParticipants: false,
          lastViewableActivityOnly: true,
          participantsLimit: 0
        });
      })
      .then((conversation) => webex.devicemanager.bindSpace({
        url,
        kmsResourceObjectUrl: conversation.kmsResourceObjectUrl
      }))
      .then(() => {
        notify('Space is bound');
        toggleDisplay('bindSpaceBtnDiv', false);
        toggleDisplay('unbindSpaceBtnDiv', true);
      })
      .catch(() => {
        notify('Space could not be bound');
      });
  }

  return false;
});

// when unbindSpace is requested
document.getElementById('unbindSpace').addEventListener('click', () => {
  if (webex.devicemanager) {
    notify('UnBinding space...');

    return webex.devicemanager.unbindSpace()
      .then(() => {
        notify('Space is unbound');
        toggleDisplay('bindSpaceBtnDiv', true);
        toggleDisplay('unbindSpaceBtnDiv', false);
      })
      .catch(() => {
        notify('Space could not be bound');
      });
  }

  return false;
});

document.getElementById('remove').addEventListener('click', () => {
  if (webex.devicemanager) {
    notify('Removing selected device...');
    const dropdown = document.getElementById('device-list-dropdown');
    const deviceId = dropdown.options[dropdown.selectedIndex].value;

    if (deviceId && deviceId !== 'Choose a Device') {
      return webex.devicemanager.remove(deviceId)
        .then(() => {
          notify('Device removed');

          return webex.devicemanager.refresh();
        })
        .then((devices) => {
          populateDeviceDropdown(devices);
          toggleDisplay('requestPinDiv', true);
          toggleDisplay('removeBtnDiv', true);
        })
        .catch(() => {
          notify('Failed to remove the device');
        });
    }
    notify('Select a device first');
  }

  return false;
});

document.getElementById('search').addEventListener('click', () => {
  if (webex.devicemanager) {
    const searchQuery = document.getElementById('searchQuery').value;

    if (searchQuery && searchQuery.length >= 3) {
      return webex.devicemanager.search({
        searchQuery
      })
        .then((res) => {
          populateDeviceSearchResults(res);
        })
        .catch((error) => {
          console.error(error);
        });
    }
    console.info('Requires atleast 3 chars to search');
  }

  return false;
});

function notify(message) {
  document.getElementById('notifications').innerHTML = message;
  setTimeout(() => {
    document.getElementById('notifications').innerHTML = '';
  }, 5000);
}

function populateDeviceDropdown(devices) {
  const deviceListDropdown = document.getElementById('device-list-dropdown');

  deviceListDropdown.length = 0;

  const defaultOption = document.createElement('option');

  defaultOption.text = 'Choose a Device';
  deviceListDropdown.add(defaultOption);
  deviceListDropdown.selectedIndex = 0;

  let option;

  devices.forEach((device) => {
    option = document.createElement('option');
    option.text = device.deviceInfo.description || device.deviceInfo.name;
    option.value = device.id;
    deviceListDropdown.add(option);
  });
}

function populateDeviceAudioState(audioState) {
  document.getElementById('getAudioStateContentsDiv').innerHTML = `<div>
    <ul>
      <li>Muted: ${audioState.microphones.muted}</li>
      <li>volume current level: ${audioState.volume.level}</li>
      <li>volume max level: ${audioState.volume.max}</li>
      <li>volume min level: ${audioState.volume.min}</li>
      <li>volume step level: ${audioState.volume.step}</li>
    </ul>
    <div id='hideAudioStateBtnDiv' style=muted"display:none;">
      <button id="hideAudioState" title="hideAudioState" type="button">hideAudioState</button>
    </div>
  </div>`;
  toggleDisplay('getAudioStateContentsDiv', true);
  toggleDisplay('hideAudioStateBtnDiv', true);
  // hideAudioState of the paired device
  document.getElementById('hideAudioState').addEventListener('click', () => {
    toggleDisplay('getAudioStateContentsDiv', false);
    toggleDisplay('hideAudioStateBtnDiv', false);
  });
}

function populateDeviceSearchResults(response) {
  let devices = '';

  response.forEach((device) => {
    devices += `
      <li style='list-style-type: none'>
        <input type='radio' name='deviceRadio' onclick='requestPinChallenge("${device.id}")'/>
        <label>${device.description || device.name}</label>
      </li>`;
  });
  document.getElementById('getDeviceSearchResultsDiv').innerHTML = `<div>
    <ul>
      ${devices}
    </ul>
    <div id='hideDeviceSearchResultsBtnDiv' style=muted"display:none;">
      <button id="hideDeviceSearchResults" title="hideDeviceSearchResults" type="button">hideDeviceSearchResults</button>
    </div>
  </div>`;
  toggleDisplay('getDeviceSearchResultsDiv', true);
  toggleDisplay('hideDeviceSearchResults', true);
  // hideAudioState of the paired device
  document.getElementById('hideDeviceSearchResults').addEventListener('click', () => {
    toggleDisplay('getDeviceSearchResultsDiv', false);
    toggleDisplay('hideDeviceSearchResults', false);
  });
}

function toggleDisplay(elementId, status) {
  const element = document.getElementById(elementId);

  if (status) {
    element.style.display = 'block';
  }
  else {
    element.style.display = 'none';
  }
}

document.getElementById('credentials').addEventListener('submit', (event) => {
  // let's make sure we don't reload the page when we submit the form
  event.preventDefault();
  connect();
});
