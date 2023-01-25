import {parse} from '@webex/ts-sdp';

interface IPeerConnectionUtils {
  convertCLineToIpv4: (sdp: string) => string;
  adjustH264Profile: (sdp: string, maxFsValue: number) => string;
}

const PeerConnectionUtils = {} as IPeerConnectionUtils;

// max-fs values for all H264 profile levels
const maxFsForProfileLevel = {
  10: 99,
  11: 396,
  12: 396,
  13: 396,
  20: 396,
  21: 792,
  22: 1620,
  30: 1620,
  31: 3600,
  32: 5120,
  40: 8192,
  41: 8192,
  42: 8704,
  50: 22080,
  51: 36864,
  52: 36864,
  60: 139264,
  61: 139264,
  62: 139264,
};

const framesPerSecond = 30;

/**
 * Convert C line to IPv4
 * @param {string} sdp
 * @returns {string}
 */
PeerConnectionUtils.convertCLineToIpv4 = (sdp: string) => {
  let replaceSdp = sdp;

  // TODO: remove this once linus supports Ipv6 c line.currently linus rejects SDP with c line having ipv6 candidates we are
  // mocking ipv6 to ipv4 candidates
  // https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-299232
  replaceSdp = replaceSdp.replace(/c=IN IP6 .*/gi, 'c=IN IP4 0.0.0.0');

  return replaceSdp;
};

/**
 * estimate profile levels for max-fs & max-mbps values
 * @param {string} sdp
 * @param {number} maxFsValue
 * @returns {string}
 */
PeerConnectionUtils.adjustH264Profile = (sdp: string, maxFsValue: number) => {
  // converting with ts-sdp parser, no munging
  const parsedSdp = parse(sdp);

  parsedSdp.avMedia.forEach((media) => {
    if (media.type === 'video') {
      media.codecs.forEach((codec) => {
        if (codec.name?.toUpperCase() === 'H264') {
          // there should really be just 1 fmtp line, but just in case, we process all of them
          codec.fmtParams = codec.fmtParams.map((fmtp) => {
            const parsedRegex = fmtp.match(/(.*)profile-level-id=(\w{4})(\w{2})(.*)/);

            if (parsedRegex && parsedRegex.length === 5) {
              const stuffBeforeProfileLevelId = parsedRegex[1];
              const profile = parsedRegex[2].toLowerCase();
              const levelId = parseInt(parsedRegex[3], 16);
              const stuffAfterProfileLevelId = parsedRegex[4];

              if (!maxFsForProfileLevel[levelId]) {
                throw new Error(
                  `found unsupported h264 profile level id value in the SDP: ${levelId}`
                );
              }

              if (maxFsForProfileLevel[levelId] === maxFsValue) {
                // profile level already matches our desired max-fs value, so we don't need to do anything
                return fmtp;
              }
              if (maxFsForProfileLevel[levelId] < maxFsValue) {
                // profile level has too low max-fs, so we need to override it (this is upgrading)
                return `${fmtp};max-fs=${maxFsValue};max-mbps=${maxFsValue * framesPerSecond}`;
              }

              // profile level has too high max-fs value, so we need to use a lower level

              // find highest level that has the matching maxFs
              const newLevelId = Object.keys(maxFsForProfileLevel)
                .reverse()
                .find((key) => maxFsForProfileLevel[key] === maxFsValue);

              if (newLevelId) {
                // Object.keys returns keys as strings, so we need to parse it to an int again and then convert to hex
                const newLevelIdHex = parseInt(newLevelId, 10).toString(16);

                return `${stuffBeforeProfileLevelId}profile-level-id=${profile}${newLevelIdHex};max-mbps=${
                  maxFsValue * framesPerSecond
                }${stuffAfterProfileLevelId}`;
              }

              throw new Error(`unsupported maxFsValue: ${maxFsValue}`);
            }

            return fmtp;
          });
        }
      });
    }
  });

  return parsedSdp.toString();
};

export default PeerConnectionUtils;
