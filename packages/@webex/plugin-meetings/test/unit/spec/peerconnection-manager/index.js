import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import PeerConnectionManager from '@webex/plugin-meetings/src/peer-connection-manager/index';
import StaticConfig from '@webex/plugin-meetings/src/common/config';
import {InvalidSdpError} from '@webex/plugin-meetings/src/common/errors/webex-errors';

describe('Peerconnection Manager', () => {
  describe('Methods', () => {
    let peerConnection = null;
    let sdp = null;

    beforeEach(() => {
      sdp = 'v=0\r\no=- 1026633665396855335 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0 1 2\r\nr\na=msid-semantic: WMS\r\nm=audio 40903 UDP/TLS/RTP/SAVPF 111 63 103 104 9 0 8 106 105 13 110 112 113 126\r\nb=TIAS:64000\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=candidate:602151403 1 udp 2122262783 2401:4900:2301:c2cb:5ea9:46d5:7321:2531 47974 typ host generation 0 network-id 2 network-cost 900\r\na=candidate:675071982 1 udp 2122197247 2401:4900:33fc:314c:ad57:3e1d:befe:34b7 41234 typ host generation 0 network-id 3 network-cost 900\r\na=candidate:1835525403 1 tcp 1518283007 2401:4900:2301:c2cb:5ea9:46d5:7321:2531 9 typ host tcptype active generation 0 network-id 2 network-cost 900\r\na=candidate:1723808542 1 tcp 1518217471 2401:4900:33fc:314c:ad57:3e1d:befe:34b7 9 typ host tcptype active generation 0 network-id 3 network-cost 900\r\na=ice-ufrag:zK3G\r\na=ice-pwd:e9xgQIGnRsJvaFpvTAenr5JQ\r\na=ice-options:trickle\r\nm=video 43875 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 122 121 127\r\nb=TIAS:4000000\r\nc=IN IP4 0.0.0.0\r\na=periodic-keyframes:20\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=candidate:602151403 1 udp 2122262783 2401:4900:2301:c2cb:5ea9:46d5:7321:2531 41619 typ host generation 0 network-id 2 network-cost 900\r\na=candidate:675071982 1 udp 2122197247 2401:4900:33fc:314c:ad57:3e1d:befe:34b7 47098 typ host generation 0 network-id 3 network-cost 900\r\na=candidate:1835525403 1 tcp 1518283007 2401:4900:2301:c2cb:5ea9:46d5:7321:2531 9 typ host tcptype active generation 0 network-id 2 network-cost 900\r\na=candidate:1723808542 1 tcp 1518217471 2401:4900:33fc:314c:ad57:3e1d:befe:34b7 9 typ host tcptype active generation 0 network-id 3 network-cost 900\r\na=ice-ufrag:zK3G\r\na=ice-pwd:e9xgQIGnRsJvaFpvTAenr5JQ\r\na=ice-options:trickle\r\na=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r\nm=video 49298 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 122 121 127\r\nb=TIAS:4000000\r\nc=IN IP4 0.0.0.0\r\na=periodic-keyframes:20\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=candidate:602151403 1 udp 2122262783 2401:4900:2301:c2cb:5ea9:46d5:7321:2531 37670 typ host generation 0 network-id 2 network-cost 900\r\na=candidate:675071982 1 udp 2122197247 2401:4900:33fc:314c:ad57:3e1d:befe:34b7 37790 typ host generation 0 network-id 3 network-cost 900\r\na=candidate:1835525403 1 tcp 1518283007 2401:4900:2301:c2cb:5ea9:46d5:7321:2531 9 typ host tcptype active generation 0 network-id 2 network-cost 900\r\na=candidate:1723808542 1 tcp 1518217471 2401:4900:33fc:314c:ad57:3e1d:befe:34b7 9 typ host tcptype active generation 0 network-id 3 network-cost 900\r\na=ice-ufrag:zK3G\r\na=ice-pwd:e9xgQIGnRsJvaFpvTAenr5JQ\r\na=ice-options:trickle\r\na=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f;\r\na=content:slides\r\n';

      peerConnection = {
        iceGatheringState: 'new',
        onicecandidate: null,
        onicecandidateerror: null,
        localDescription: {sdp}
      };

      Object.defineProperty(global.window, 'RTCSessionDescription', {
        writable: true,
        value: class {
          constructor(options) {
            this.type = options.type;
            this.sdp = options.sdp;
          }
        }
      });
    });
    describe('setRemoteSessionDetails', () => {
      it('change the start bitrate on remoteSDP and remove extmap', async () => {
        StaticConfig.set({bandwidth: {audio: 50, video: 500, startBitrate: 2000}});
        let result = null;
        const setRemoteDescription = sinon.stub().callsFake((args) => {
          result = args;

          return Promise.resolve();
        });
        const remoteSdp = 'v=0\r\n' +
        'm=video 5004 UDP/TLS/RTP/SAVPF 102 127 97 99\r\n' +
        'a=fmtp:102 profile-level-id=42e016;packetization-mode=1;max-mbps=244800;max-fs=8160;max-fps=3000;max-dpb=12240;max-rcmd-nalu-size=196608;level-asymmetry-allowed=1\r\n' +
        'a=rtpmap:127 H264/90000\r\n' +
        'a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n' +
        'a=fmtp:127 profile-level-id=42e016;max-mbps=244800;max-fs=8160;max-fps=3000;max-dpb=12240;max-rcmd-nalu-size=196608;level-asymmetry-allowed=1\r\n';

        const resultSdp = 'v=0\r\n' +
        'm=video 5004 UDP/TLS/RTP/SAVPF 102 127 97 99\r\n' +
        'a=fmtp:102 profile-level-id=42e016;packetization-mode=1;max-mbps=244800;max-fs=8160;max-fps=3000;max-dpb=12240;max-rcmd-nalu-size=196608;level-asymmetry-allowed=1;x-google-start-bitrate=2000\r\n' +
        'a=rtpmap:127 H264/90000\r\r\n' +
        'a=fmtp:127 profile-level-id=42e016;max-mbps=244800;max-fs=8160;max-fps=3000;max-dpb=12240;max-rcmd-nalu-size=196608;level-asymmetry-allowed=1;x-google-start-bitrate=2000\r\n';
        const peerConnection = {
          signalingState: 'have-local-offer',
          setRemoteDescription,
          enableExtmap: false
        };

        await PeerConnectionManager.setRemoteSessionDetails(peerConnection, 'answer', remoteSdp, {});

        assert.equal(result.sdp, resultSdp);
      });

      it('dont change the start bitrate on remoteSDP if default value is 0', async () => {
        StaticConfig.set({bandwidth: {audio: 50, video: 500, startBitrate: 0}});
        let result = null;
        const setRemoteDescription = sinon.stub().callsFake((args) => {
          result = args;

          return Promise.resolve();
        });
        const remoteSdp = 'v=0\r\n' +
        'm=video 5004 UDP/TLS/RTP/SAVPF 102 127 97 99\r\n' +
        'a=fmtp:102 profile-level-id=42e016;packetization-mode=1;max-mbps=244800;max-fs=8160;max-fps=3000;max-dpb=12240;max-rcmd-nalu-size=196608;level-asymmetry-allowed=1\r\n' +
        'a=rtpmap:127 H264/90000\r\n' +
        'a=fmtp:127 profile-level-id=42e016;max-mbps=244800;max-fs=8160;max-fps=3000;max-dpb=12240;max-rcmd-nalu-size=196608;level-asymmetry-allowed=1\r\n';

        const peerConnection = {
          signalingState: 'have-local-offer',
          setRemoteDescription
        };

        await PeerConnectionManager.setRemoteSessionDetails(peerConnection, 'answer', remoteSdp, {});

        assert.equal(result.sdp, remoteSdp);
      });

      it('removes xTLS candidates from the remote sdp', async () => {
        StaticConfig.set({bandwidth: {}});

        const remoteSdpWithXtlsCandidates = 'v=0\r\n' +
        'm=video 5004 UDP/TLS/RTP/SAVPF 102 127 97 99\r\n' +
        'a=candidate:1 1 UDP 2130706175 18.206.82.54 9000 typ host\r\n' +
        'a=candidate:2 1 TCP 1962934271 18.206.82.54 5004 typ host tcptype passive\r\n' +
        'a=candidate:3 1 TCP 1962934015 18.206.82.54 9000 typ host tcptype passive\r\n' +
        'a=candidate:4 1 xTLS 1795162111 external-media2.aintm-a-6.int.infra.webex.com 443 typ host tcptype passive fingerprint sha-1;55:B8:1D:94:BC:9D:B2:A5:5E:82:E7:84:C6:C8:10:AC:D3:FD:96:26\r\n' +
        'a=rtpmap:127 H264/90000\r\n' +
        'a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n' +
        'm=video 9000 UDP/TLS/RTP/SAVPF 102 127 97 99\r\n' +
        'a=candidate:1 1 xTLS 1795162111 external-media2.aintm-a-6.int.infra.webex.com 443 typ host tcptype passive fingerprint sha-1;55:B8:1D:94:BC:9D:B2:A5:5E:82:E7:84:C6:C8:10:AC:D3:FD:96:26\r\n' +
        'a=candidate:2 1 TCP 1962934271 18.206.82.54 5004 typ host tcptype passive\r\n' +
        'a=fmtp:127 profile-level-id=42e016;max-mbps=244800;max-fs=8160;max-fps=3000;max-dpb=12240;max-rcmd-nalu-size=196608;level-asymmetry-allowed=1\r\n';

        // same as remoteSdpWithXtlsCandidates but without the xtls candidates
        const resultSdp = 'v=0\r\n' +
        'm=video 5004 UDP/TLS/RTP/SAVPF 102 127 97 99\r\n' +
        'a=candidate:1 1 UDP 2130706175 18.206.82.54 9000 typ host\r\n' +
        'a=candidate:2 1 TCP 1962934271 18.206.82.54 5004 typ host tcptype passive\r\n' +
        'a=candidate:3 1 TCP 1962934015 18.206.82.54 9000 typ host tcptype passive\r\n' +
        'a=rtpmap:127 H264/90000\r\n' +
        'a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n' +
        'm=video 9000 UDP/TLS/RTP/SAVPF 102 127 97 99\r\n' +
        'a=candidate:2 1 TCP 1962934271 18.206.82.54 5004 typ host tcptype passive\r\n' +
        'a=fmtp:127 profile-level-id=42e016;max-mbps=244800;max-fs=8160;max-fps=3000;max-dpb=12240;max-rcmd-nalu-size=196608;level-asymmetry-allowed=1\r\n';

        const peerConnection = {
          signalingState: 'have-local-offer',
          setRemoteDescription: sinon.stub().resolves(),
          enableExtmap: true
        };

        await PeerConnectionManager.setRemoteSessionDetails(peerConnection, 'answer', remoteSdpWithXtlsCandidates, '');

        assert.calledWith(peerConnection.setRemoteDescription, new global.window.RTCSessionDescription({sdp: resultSdp, type: 'answer'}));
      });
    });

    describe('iceCandidate', () => {
      beforeEach(() => {
        StaticConfig.set({bandwidth: {audio: 50, video: 500, startBitrate: 0}});
        peerConnection.sdp = null;
      });
      it('ice gathering already completed', async () => {
        peerConnection.iceGatheringState = 'complete';

        await PeerConnectionManager.iceCandidate(peerConnection, {remoteQualityLevel: 'HIGH'});
        console.error('Came her with sdp resolved');
        assert(peerConnection.sdp.search('max-fs:8192'), true);
      });

      it('listen onIceCandidate,onicecandidateerror and onIceGatheringStateChange', async () => {
        peerConnection.iceGatheringState = 'none';
        setTimeout(() => {
          peerConnection.onicecandidate({candidate: null});
        }, 1000);
        await PeerConnectionManager.iceCandidate(peerConnection, {remoteQualityLevel: 'HIGH'});
        assert.isFunction(peerConnection.onIceGatheringStateChange);
        assert.isFunction(peerConnection.onicecandidate);
        assert.isFunction(peerConnection.onicecandidateerror);
      });

      it('generate sdp with iceGatheringstate is `complet`', async () => {
        peerConnection.iceGatheringState = 'none';
        setTimeout(() => {
          peerConnection.iceGatheringState = 'complete';
          peerConnection.onIceGatheringStateChange();
        }, 1000);
        await PeerConnectionManager.iceCandidate(peerConnection, {remoteQualityLevel: 'HIGH'})
          .then(() => {
            assert(peerConnection.sdp.search('max-fs:8192'), true);
          });
      });

      it('should still generate sdp even if onicecandidateerror is called ', async () => {
        peerConnection.iceGatheringState = 'none';
        setTimeout(() => {
          peerConnection.onicecandidateerror();
          peerConnection.onicecandidate({candidate: null});
        }, 1000);
        await PeerConnectionManager.iceCandidate(peerConnection, {remoteQualityLevel: 'HIGH'})
          .then(() => {
            assert(peerConnection.sdp.search('max-fs:8192'), true);
          });
      });

      it('should throw generated SDP does not have candidates ', async () => {
        peerConnection.iceGatheringState = 'none';
        peerConnection.localDescription.sdp = 'v=0\r\no=- 1026633665396855335 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0 1 2\r\nr\na=msid-semantic: WMS\r\nm=audio 40903 UDP/TLS/RTP/SAVPF 111 63 103 104 9 0 8 106 105 13 110 112 113 126\r\nb=TIAS:64000\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:zK3G\r\na=ice-pwd:e9xgQIGnRsJvaFpvTAenr5JQ\r\na=ice-options:trickle\r\nm=video 43875 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 122 121 127\r\nb=TIAS:4000000\r\nc=IN IP4 0.0.0.0\r\na=periodic-keyframes:20\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:zK3G\r\na=ice-pwd:e9xgQIGnRsJvaFpvTAenr5JQ\r\na=ice-options:trickle\r\na=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r\nm=video 49298 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 122 121 127\r\nb=TIAS:4000000\r\nc=IN IP4 0.0.0.0\r\na=periodic-keyframes:20\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:zK3G\r\na=ice-pwd:e9xgQIGnRsJvaFpvTAenr5JQ\r\na=ice-options:trickle\r\na=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f;\r\na=content:slides\r\n';
        setTimeout(() => {
          peerConnection.onicecandidate({candidate: null});
        }, 1000);
        await assert.isRejected(PeerConnectionManager.iceCandidate(peerConnection, {remoteQualityLevel: 'HIGH'}), InvalidSdpError);
      });
    });
  });
});
