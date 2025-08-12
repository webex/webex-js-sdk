/**
 * Wires up call control UI: mute, hold, and the DTMF dialer
 *
 * @param {Object} cfg
 * @param {Object} cfg.els - Elements map used in the lab
 * @param {() => any} cfg.getActiveCall - Returns the active call object
 * @param {() => any} cfg.getLocalStream - Returns the local microphone stream
 */
export function setupCallControls({ els, getActiveCall, getLocalStream }) {
  if (!els) return;

  // Mute/Unmute
  if (els.mute) {
    els.mute.addEventListener('click', () => {
      const call = getActiveCall?.();
      const stream = getLocalStream?.();
      if (!call || !stream) return;
      call.mute(stream, 'user_mute');
    });
  }

  // Hold/Resume
  if (els.hold) {
    els.hold.addEventListener('click', () => {
      const call = getActiveCall?.();
      if (!call) return;
      call.doHoldResume();
    });
  }

  // Dialpad per-key sending
  document.querySelectorAll('.dialpad button[data-tone]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const tone = btn.getAttribute('data-tone');
        if (els.dtmfDisplay) {
          els.dtmfDisplay.value += tone;
        }
        const call = getActiveCall?.();
        if (call) {
          try { call.sendDigit(tone); } catch (e) { /* ignore */ }
        }
      });
    });

  // Send all digits in input
  if (els.sendDigits) {
    els.sendDigits.addEventListener('click', () => {
      const call = getActiveCall?.();
      const digits = els.dtmfDisplay?.value?.trim();
      if (call && digits) {
        call.sendDigit(digits);
      }
    });
  }

  // Clear display
  if (els.clearDigits) {
    els.clearDigits.addEventListener('click', () => {
      if (els.dtmfDisplay) els.dtmfDisplay.value = '';
    });
  }
}



