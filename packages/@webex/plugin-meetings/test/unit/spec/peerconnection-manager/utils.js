import {assert} from '@webex/test-helper-chai';
import PeerConnectionUtils from '@webex/plugin-meetings/src/peer-connection-manager/util';

import {
  SDP_MULTIPLE_VIDEO_CODECS,
  SDP_MULTIPLE_VIDEO_CODECS_WITH_LOWERED_H264_PROFILE_LEVEL,
  SDP_MULTIPLE_VIDEO_CODECS_WITH_MAX_FS,
} from './utils.test-fixtures';

describe('Peerconnection Manager', () => {
  describe('Utils', () => {
    describe('convertCLineToIpv4', () => {
      it('changes ipv6 to ipv4 default', () => {
        const localSdp =
          'v=0\r\n' +
          'm=video 5004 UDP/TLS/RTP/SAVPF 102 127 97 99\r\n' +
          'c=IN IP6 2607:fb90:d27c:b314:211a:32dd:c47f:ffe\r\n' +
          'a=rtpmap:127 H264/90000\r\n';
        const resultSdp =
          'v=0\r\n' +
          'm=video 5004 UDP/TLS/RTP/SAVPF 102 127 97 99\r\n' +
          'c=IN IP4 0.0.0.0\r\n' +
          'a=rtpmap:127 H264/90000\r\n';

        const temp = PeerConnectionUtils.convertCLineToIpv4(localSdp);

        assert.equal(temp, resultSdp);
      });
    });

    describe('adjustH264Profile', () => {
      it('appends max-fs and max-mbps to h264 fmtp lines when h264MaxFs value is higher than the value from the profile', () => {
        const modifiedSdp = PeerConnectionUtils.adjustH264Profile(SDP_MULTIPLE_VIDEO_CODECS, 8192);

        assert.equal(modifiedSdp, SDP_MULTIPLE_VIDEO_CODECS_WITH_MAX_FS);
      });
      it('keeps fmtp lines the same when h264MaxFs value matches the value from the profile', () => {
        const modifiedSdp = PeerConnectionUtils.adjustH264Profile(SDP_MULTIPLE_VIDEO_CODECS, 3600);

        assert.equal(modifiedSdp, SDP_MULTIPLE_VIDEO_CODECS);
      });
      it('changes the profile level in h264 fmtp lines when h264MaxFs value is lower than the value from the profile', () => {
        const modifiedSdp = PeerConnectionUtils.adjustH264Profile(SDP_MULTIPLE_VIDEO_CODECS, 1620);

        assert.equal(modifiedSdp, SDP_MULTIPLE_VIDEO_CODECS_WITH_LOWERED_H264_PROFILE_LEVEL);
      });
    });
  });
});
