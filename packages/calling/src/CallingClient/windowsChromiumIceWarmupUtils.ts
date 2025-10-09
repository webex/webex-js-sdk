// This file contains a workaround for a known issue in Windows Chromium-based browsers
// See: https://issues.chromium.org/issues/332933530
// There is a rare condition where WebRTC doesn't work on the first try due to ICE gathering issues.
// This function attempts to "warm up" the ICE gathering process by creating a pair of peer connections
// and forcing ICE candidate gathering and exchange before the actual call setup.
// We need to try establishing the connection through the srflx candidates since the host candidate won't work
// This is intended to be called once at the start of the calling SDK to reduce the likelihood of ICE issues later.
function waitForIceComplete(pc: RTCPeerConnection, timeoutMs: number) {
  return new Promise((resolve) => {
    if (!pc) {
      resolve({ok: false, reason: 'no-pc'});

      return;
    }
    if (pc.iceGatheringState === 'complete') {
      resolve({ok: true, reached: 'already'});

      return;
    }

    let done = false;
    const onChange = () => {
      if (pc.iceGatheringState === 'complete' && !done) {
        done = true;
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve({ok: true, reached: 'event'});
      }
    };
    pc.addEventListener('icegatheringstatechange', onChange);

    // timeout fallback
    setTimeout(() => {
      if (done) return;
      done = true;
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve({ok: pc.iceGatheringState === 'complete', reached: 'timeout'});
    }, timeoutMs);
  });
}

export default async function windowsChromiumIceWarmup({
  iceServers = [
    {urls: 'stun:stun01a-us.bcld.webex.com:5004'},
    {urls: 'stun:stun02a-us.bcld.webex.com:5004'},
  ],
  timeoutMs = 1000,
}) {
  const pc1 = new RTCPeerConnection({iceServers, iceCandidatePoolSize: 1});
  const pc2 = new RTCPeerConnection({iceServers, iceCandidatePoolSize: 1});

  const candidates: {pc1: RTCIceCandidate[]; pc2: RTCIceCandidate[]} = {pc1: [], pc2: []};
  pc1.onicecandidate = (e) => {
    if (e.candidate && e.candidate.type !== 'host') {
      candidates.pc1.push(e.candidate);
    }
  };

  await pc1.createDataChannel('warmup');
  await pc1.addTransceiver('audio');

  const offer = await pc1.createOffer();
  await pc1.setLocalDescription(offer);

  await waitForIceComplete(pc1, timeoutMs);

  await pc2.setRemoteDescription(offer);
  pc2.onicecandidate = (e) => {
    if (e.candidate && e.candidate.type !== 'host') {
      candidates.pc2.push(e.candidate);
    }
  };

  const answer = await pc2.createAnswer();
  await pc2.setLocalDescription(answer);
  await pc1.setRemoteDescription(answer);

  await waitForIceComplete(pc2, timeoutMs);

  // Add ice candidates that were gathered
  await Promise.all([
    ...candidates.pc1.map((candidate) => pc2.addIceCandidate(candidate).catch(console.error)),
    ...candidates.pc2.map((candidate) => pc1.addIceCandidate(candidate).catch(console.error)),
  ]);

  pc1.close();
  pc2.close();
}
