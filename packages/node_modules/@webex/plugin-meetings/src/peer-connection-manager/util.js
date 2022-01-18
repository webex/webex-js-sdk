
const PeerConnectionUtils = {};

/**
 * Convert C line to IPv4
 * @param {String} sdp
 * @returns {String}
 */
PeerConnectionUtils.convertCLineToIpv4 = (sdp) => {
  let replaceSdp = sdp;

  // TODO: remove this once linus supports Ipv6 c line.currently linus rejects SDP with c line having ipv6 candidates we are
  // mocking ipv6 to ipv4 candidates
  // https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-299232
  replaceSdp = replaceSdp.replace(/c=IN IP6 .*/gi, 'c=IN IP4 0.0.0.0');

  return replaceSdp;
};
export default PeerConnectionUtils;
