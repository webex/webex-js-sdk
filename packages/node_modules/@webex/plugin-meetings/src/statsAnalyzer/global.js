const STATS_DEFAULT = {
  encryption: 'sha-256',
  audio: {
    send: {
      maxPacketLossRatio: 0,
      availableBandwidth: 0,
      bytesSent: 0,
      meanRemoteJitter: [],
      meanRoundTripTime: []
    },
    recv: {
      availableBandwidth: 0,
      bytesReceived: 0,
      meanRtpJitter: [],
      meanRoundTripTime: []
    }
  },
  video: {
    send: {
      maxPacketLossRatio: 0,
      availableBandwidth: 0,
      meanRemoteJitter: [],
      meanRoundTripTime: []
    },
    recv: {
      availableBandwidth: 0,
      totalPacketsLost: 0,
      meanRtpJitter: [],
      meanRoundTripTime: []

    },
    latency: 0,
    packetsLost: 0
  },
  share: {
    send: {
      maxPacketLossRatio: 0,
      availableBandwidth: 0,
      totalPacketsLost: 0,
      meanRemoteJitter: [],
      meanRoundTripTime: []
    },
    recv: {
      availableBandwidth: 0,
      meanRtpJitter: [],
      meanRoundTripTime: []
    },

    latency: 0,
    packetsLost: 0
  },
  bandwidth: {
    systemBandwidth: 0,
    sentPerSecond: 0,
    encodedPerSecond: 0,
    helper: {
      audioBytesSent: 0,
      videoBytestSent: 0
    },
    speed: 0
  },
  results: {},
  connectionType: {
    systemNetworkType: 'unknown',
    systemIpAddress: '0.0.0.0',
    local: {
      candidateType: [],
      transport: [],
      ipAddress: [],
      networkType: []
    },
    remote: {
      candidateType: [],
      transport: [],
      ipAddress: [],
      networkType: []
    }
  },
  resolutions: {
    audio: {
      send: {
        width: 0,
        height: 0
      },
      recv: {
        width: 0,
        height: 0
      }
    },
    video: {
      send: {
        width: 0,
        height: 0
      },
      recv: {
        width: 0,
        height: 0
      }
    },
    share: {
      send: {
        width: 0,
        height: 0
      },
      recv: {
        width: 0,
        height: 0
      }
    }
  },
  internal: {
    audio: {
      send: {},
      recv: {}
    },
    video: {
      send: {},
      recv: {}
    },
    share: {
      send: {},
      recv: {}
    },
    remote: {

    },
    candidates: {}
  }
};

export default STATS_DEFAULT;
