const STATS_DEFAULT = {
  encryption: 'sha-256',
  bandwidth: {
    systemBandwidth: 0,
    sentPerSecond: 0,
    encodedPerSecond: 0,
    helper: {
      audioBytesSent: 0,
      videoBytestSent: 0,
    },
    speed: 0,
  },
  results: {},
  connectionType: {
    systemNetworkType: 'unknown',
    systemIpAddress: '0.0.0.0',
    local: {
      candidateType: [],
      transport: [],
      ipAddress: [],
      networkType: [],
    },
    remote: {
      candidateType: [],
      transport: [],
      ipAddress: [],
      networkType: [],
    },
  },
  resolutions: {},
  internal: {
    remote: {},
    candidates: {},
  },
};

export default STATS_DEFAULT;
