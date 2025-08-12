import { initCalling, initOauth } from './modules/auth.js';
import { register, deregister, getPrimaryLine } from './modules/registration.js';
import { setupCallControls } from './modules/call-controls.js';

let calling; // Calling root
let callingClient; // CallingClient
let line; // Primary line
let localAudioStream; // Calling MicrophoneStream
let activeCall; // Current Call
let consultCall; // Second call during consult transfer

const els = {
  token: document.getElementById('access-token'),
  fedramp: document.getElementById('fedramp'),
  intEnv: document.getElementById('integration-env'),
  init: document.getElementById('btn-init'),
  oauth: document.getElementById('btn-oauth'),
  authStatus: document.getElementById('auth-status'),
  btnRegister: document.getElementById('btn-register'),
  btnDeregister: document.getElementById('btn-deregister'),
  regStatus: document.getElementById('registration-status'),
  btnMedia: document.getElementById('btn-media'),
  btnLineRegister: document.getElementById('btn-line-register'),
  localAudio: document.getElementById('local-audio'),
  remoteAudio: document.getElementById('remote-audio'),
  dest: document.getElementById('destination'),
  call: document.getElementById('btn-call'),
  end: document.getElementById('btn-end'),
  answer: document.getElementById('btn-answer'),
  endIncoming: document.getElementById('btn-end-incoming'),
  incomingInfo: document.getElementById('incoming-info'),
  mute: document.getElementById('btn-mute'),
  hold: document.getElementById('btn-hold'),
  dtmfDisplay: document.getElementById('dtmf-display'),
  sendDigits: document.getElementById('btn-send-digits'),
  clearDigits: document.getElementById('btn-clear-digits'),
  callStatus: document.getElementById('call-status'),
  transferTarget: document.getElementById('transfer-target'),
  transferType: document.getElementById('transfer-type'),
  transferBtn: document.getElementById('btn-transfer'),
  endSecondBtn: document.getElementById('btn-end-second'),
  transferStatus: document.getElementById('transfer-status')
};

function setAuthUI(enabled) {
  els.btnRegister.disabled = !enabled;
  els.authStatus.textContent = enabled ? 'Initialized' : 'Not initialized';
}

function setRegistrationUI(registered) {
  els.btnRegister.disabled = registered;
  els.btnDeregister.disabled = !registered;
  els.regStatus.textContent = registered ? 'Registered' : 'Not registered';
  els.btnLineRegister.disabled = !registered;
  els.btnMedia.disabled = true;
  els.dest.disabled = !registered;
}

function setCallUI(inCall) {
  els.call.disabled = inCall;
  els.end.disabled = !inCall;
  els.mute.disabled = !inCall;
  els.hold.disabled = !inCall;
  els.sendDigits.disabled = !inCall;
  els.transferBtn.disabled = !inCall;
  els.transferTarget.disabled = !inCall;
  els.transferType.disabled = !inCall;
}

// Dialpad wiring moved to call-controls.js

async function handleInit() {
  els.init.disabled = true;
  els.authStatus.textContent = 'Initializing...';
  const token = els.token.value.trim();
  try {
    const { callingInstance, client } = await initCalling({
      token,
      fedramp: !!els.fedramp.checked,
      useIntegration: !!els.intEnv.checked
    });
    calling = callingInstance;
    callingClient = client;
    setAuthUI(true);
  } catch (e) {
    console.error(e);
    els.authStatus.textContent = 'Init failed';
  } finally {
    els.init.disabled = false;
  }
}

async function handleOAuth() {
  els.oauth.disabled = true;
  try {
    await initOauth({
      // Client ID placeholder; replace with your Integration's client ID
      clientId: 'YOUR_PUBLIC_CLIENT_ID'
    });
  } catch (e) {
    console.error('OAuth start failed', e);
  } finally {
    els.oauth.disabled = false;
  }
}

async function handleRegister() {
  try {
    await register(calling);
    // Ensure CallingClient is ready; wait for `ready` if needed
    if (!calling?.callingClient) {
      await new Promise((resolve) => calling.on('ready', resolve));
    }
    callingClient = calling.callingClient;
    line = getPrimaryLine(callingClient);
    wireLineEvents(line);
    setRegistrationUI(true);
  } catch (e) {
    console.error('Registration failed', e);
  }
}

function handleLineRegister() {
  if (!line) return;
  try {
    line.register();
    els.callStatus.textContent = 'Registering line...';
  } catch (e) {
    console.warn('Line register failed', e);
  }
}

async function handleDeregister() {
  try {
    await deregister(calling);
    setRegistrationUI(false);
    setCallUI(false);
    activeCall = undefined;
  } catch (e) {
    console.error('Deregister failed', e);
  }
}

async function handleGetMedia() {
  try {
    localAudioStream = await Calling.createMicrophoneStream({ audio: true });
    els.localAudio.srcObject = localAudioStream.outputStream;
    els.call.disabled = false;
  } catch (e) {
    console.error('Mic error', e);
  }
}

function wireActiveCall(call) {
  activeCall = call;
  setCallUI(true);

  call.on('remote_media', (track) => {
    els.remoteAudio.srcObject = new MediaStream([track]);
  });
  call.on('progress', (id) => els.callStatus.textContent = `${id}: Progress`);
  call.on('connect', (id) => els.callStatus.textContent = `${id}: Connect`);
  call.on('established', (id) => els.callStatus.textContent = `${id}: Established`);
  call.on('disconnect', () => {
    els.callStatus.textContent = 'Call Disconnected';
    setCallUI(false);
    activeCall = undefined;
    resetTransferUI();
  });
}

function wireLineEvents(theLine) {
  if (!theLine) return;
  theLine.on('registered', () => {
    els.regStatus.textContent = 'Registered (Calling)';
    const lineStatus = document.getElementById('line-status');
    if (lineStatus) lineStatus.textContent = 'Line registered';
    els.btnMedia.disabled = false;
  });
  theLine.on('line:incoming_call', (incomingCall) => {
    activeCall = incomingCall;
    els.incomingInfo.textContent = 'Incoming call...';
    els.answer.disabled = false;
    els.endIncoming.disabled = false;

    incomingCall.on('disconnect', () => {
      els.incomingInfo.textContent = 'Call ended';
      els.answer.disabled = true;
      els.endIncoming.disabled = true;
      setCallUI(false);
      activeCall = undefined;
    });

    incomingCall.on('remote_media', (track) => {
      els.remoteAudio.srcObject = new MediaStream([track]);
    });
  });
}

async function handlePlaceCall() {
  const dest = els.dest.value.trim();
  if (!line) {
    els.callStatus.textContent = 'Line not ready. Please register first.';
    return;
  }
  if (!dest) {
    els.callStatus.textContent = 'Please enter a destination address/number.';
    return;
  }
  if (!localAudioStream) {
    els.callStatus.textContent = 'Getting microphone...';
    await handleGetMedia();
    if (!localAudioStream) {
      els.callStatus.textContent = 'Microphone unavailable.';
      return;
    }
  }

  try {
    const call = line.makeCall({ type: 'uri', address: dest });
    wireActiveCall(call);
    els.callStatus.textContent = 'Dialing...';
    call.dial(localAudioStream);
  } catch (e) {
    console.error('Call failed', e);
    els.callStatus.textContent = `Call failed: ${e?.message || 'Unknown error'}`;
  }
}

function resetTransferUI() {
  els.transferStatus.textContent = 'Transfer idle';
  els.endSecondBtn.disabled = true;
  consultCall = undefined;
}

function wireConsultCall(c) {
  consultCall = c;
  els.endSecondBtn.disabled = false;
  c.on('remote_media', (track) => {
    els.remoteAudio.srcObject = new MediaStream([track]);
  });
  c.on('established', (id) => {
    els.transferStatus.textContent = `${id}: Transfer target connected`;
    els.transferBtn.textContent = 'Commit';
    els.transferBtn.disabled = false;
  });
  c.on('disconnect', () => {
    els.endSecondBtn.disabled = true;
    consultCall = undefined;
    els.transferBtn.textContent = 'Transfer';
  });
}

function handleTransfer() {
  if (!activeCall || !line) return;
  const target = els.transferTarget.value.trim();
  const type = els.transferType.value;
  if (!target) {
    els.transferStatus.textContent = 'Enter a transfer target';
    return;
  }

  // If we are in commit state for consult transfer
  if (type === 'CONSULT' && consultCall) {
    try {
      activeCall.completeTransfer('CONSULT', consultCall.getCallId(), undefined);
      els.transferStatus.textContent = 'Consult transfer completed';
      els.transferBtn.textContent = 'Transfer';
      return;
    } catch (e) {
      els.transferStatus.textContent = `Commit failed: ${e?.message || ''}`;
      return;
    }
  }

  if (type === 'BLIND') {
    try {
      activeCall.completeTransfer('BLIND', undefined, target);
      els.transferStatus.textContent = 'Blind transfer initiated';
      els.transferBtn.disabled = true;
    } catch (e) {
      els.transferStatus.textContent = `Blind transfer failed: ${e?.message || ''}`;
    }
  } else {
    // Consult transfer: hold current call and call target
    try {
      activeCall.doHoldResume();
      els.transferStatus.textContent = `Holding current call and dialing ${target}`;
      els.transferBtn.disabled = true;
      const second = line.makeCall({ type: 'uri', address: target });
      wireConsultCall(second);
      second.dial(localAudioStream);
    } catch (e) {
      els.transferStatus.textContent = `Consult transfer failed: ${e?.message || ''}`;
    }
  }
}

function handleEndSecond() {
  if (consultCall) {
    try { consultCall.end(); } catch {}
    consultCall = undefined;
    els.endSecondBtn.disabled = true;
    els.transferBtn.textContent = 'Transfer';
  }
}

function handleEndCall() {
  if (activeCall) activeCall.end();
}

function handleAnswer() {
  if (!activeCall || !localAudioStream) return;
  wireActiveCall(activeCall);
  activeCall.answer(localAudioStream);
  els.answer.disabled = true;
}

function autoInitFromHash() {
  const hash = window.location.hash?.substring(1) || '';
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  if (token) {
    els.token.value = token;
    handleInit();
  }
}

function bindUI() {
  console.log('bindUI');
  els.init.addEventListener('click', handleInit);
  els.oauth.addEventListener('click', handleOAuth);
  els.btnRegister.addEventListener('click', handleRegister);
  els.btnLineRegister.addEventListener('click', handleLineRegister);
  els.btnDeregister.addEventListener('click', handleDeregister);
  els.btnMedia.addEventListener('click', handleGetMedia);
  els.call.addEventListener('click', handlePlaceCall);
  els.end.addEventListener('click', handleEndCall);
  els.answer.addEventListener('click', handleAnswer);
  els.endIncoming.addEventListener('click', handleEndCall);
  // Controls are wired by setupCallControls
  els.transferBtn.addEventListener('click', handleTransfer);
  els.endSecondBtn.addEventListener('click', handleEndSecond);
}

// Initialize
setupCallControls({
  els,
  getActiveCall: () => activeCall,
  getLocalStream: () => localAudioStream,
});
bindUI();
autoInitFromHash();



