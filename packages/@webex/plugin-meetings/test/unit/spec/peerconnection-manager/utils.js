
import {assert} from '@webex/test-helper-chai';
import PeerConnectionUtils from '@webex/plugin-meetings/src/peer-connection-manager/util';

describe('Peerconnection Manager', () => {
  describe('Utils', () => {
    describe('convertCLineToIpv4', () => {
      it('changes ipv6 to ipv4 default', () => {
        const localSdp = 'v=0\r\n' +
        'm=video 5004 UDP/TLS/RTP/SAVPF 102 127 97 99\r\n' +
        'c=IN IP6 2607:fb90:d27c:b314:211a:32dd:c47f:ffe\r\n' +
        'a=rtpmap:127 H264/90000\r\n';
        const resultSdp = 'v=0\r\n' +
        'm=video 5004 UDP/TLS/RTP/SAVPF 102 127 97 99\r\n' +
        'c=IN IP4 0.0.0.0\r\n' +
        'a=rtpmap:127 H264/90000\r\n';


        const temp = PeerConnectionUtils.convertCLineToIpv4(localSdp);

        assert.equal(temp, resultSdp);
      });
    });
  });
});
