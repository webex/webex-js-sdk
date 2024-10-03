export const VERSION = 'unknown';
export const USER_AGENT_VERSION = 'beta';
export const REPO_NAME = 'webex-calling';
export const CALLING_USER_AGENT = `${REPO_NAME}/${USER_AGENT_VERSION}`;
export const CALL_ENDPOINT_RESOURCE = 'call';
export const CALL_STATUS_RESOURCE = 'status';
export const CALLS_ENDPOINT_RESOURCE = 'calls';
export const CISCO_DEVICE_URL = 'cisco-device-url';
export const CRLF = '\r\n';
export const DEFAULT_KEEPALIVE_INTERVAL = 30;
export const DEFAULT_LOCAL_CALL_ID = 'DefaultLocalId';
export const DEFAULT_REHOMING_INTERVAL_MAX = 120;
export const DEFAULT_REHOMING_INTERVAL_MIN = 60;
export const DEFAULT_SESSION_TIMER = 1000 * 60 * 10;
export const DEVICES_ENDPOINT_RESOURCE = 'devices';
export const DISCOVERY_URL = 'https://ds.ciscospark.com/v1/region';
export const DUMMY_METRICS = {
  'rtp-rxstat': {
    Dur: 0,
    Pkt: 0,
    Oct: 0,
    LatePkt: 0,
    LostPkt: 0,
    AvgJit: 0,
    VQMetrics: {
      VoRxCodec: 'unknown',
      VoPktSizeMs: 0,
      maxJitter: 0,
      VoOneWayDelayMs: 0,
      networkType: 'unknown',
      hwType: 'unknown',
    },
  },
  'rtp-txstat': {
    Dur: 0,
    Pkt: 0,
    Oct: 0,
    VQMetrics: {
      VoTxCodec: 'unknown',
      rtpBitRate: 0,
    },
  },
};
export const DUMMY_MOBIUS_URL = 'https://mobius.aintgen-a-1.int.infra.webex.com/api/v1';
export const FETCH_NAME = /^[a-zA-Z ]+/;
export const IP_ENDPOINT = 'myip';
export const INITIAL_SEQ_NUMBER = 1;
export const MEDIA_ENDPOINT_RESOURCE = 'media';
export const NETWORK_FLAP_TIMEOUT = 2000;
export const CALL_HOLD_SERVICE = 'callhold';
export const CALL_TRANSFER_SERVICE = 'calltransfer';
export const HOLD_ENDPOINT = 'hold';
export const TRANSFER_ENDPOINT = 'commit';
export const RESUME_ENDPOINT = 'resume';
export const SPARK_USER_AGENT = 'spark-user-agent';
export const REGISTER_RETRY_TIMEOUT = 10000;
export const SUPPLEMENTARY_SERVICES_TIMEOUT = 10000;
export const API_V1 = '/api/v1';
export const URL_ENDPOINT = '/calling/web/';
export const VALID_PHONE = /[\d\s()*#+.-]+/;
export const WEB_AGENT = '(web)';
export const WEBEX = 'webex';
export const WEBEX_WEB_CLIENT = 'webex-web-client';
export const CALLER_ID_FILE = 'CallerId';
export const UTILS_FILE = 'utils';
export const CALLING_CLIENT_FILE = 'CallingClient';
export const LINE_FILE = 'line';
export const CALL_FILE = 'call';
export const CALL_MANAGER_FILE = 'callManager';
export const METRIC_FILE = 'metric';
export const REGISTRATION_FILE = 'register';
export const CODEC_ID = 'codecId';
export const MEDIA_ID = 'id';
export const RTC_ICE_CANDIDATE_PAIR = 'RTCIceCandidatePair_';
export const LOCAL_CANDIDATE_ID = 'localCandidateId';
export const RTC_ICE_CANDIDATE = 'RTCIceCandidate_';
export const NETWORK_TYPE = 'networkType';
export const RTC_CODEC = 'RTCCodec_';
export const INBOUND_CODEC_MATCH = 'CIT01_';
export const OUTBOUND_CODEC_MATCH = 'COT01_';
export const MIME_TYPE = 'mimeType';
export const REMOTE_INBOUND_RTP = 'remote-inbound-rtp';
export const TOTAL_ROUND_TRIP_TIME = 'totalRoundTripTime';
export const ROUND_TRIP_TIME_MEASUREMENTS = 'roundTripTimeMeasurements';
export const INBOUND_RTP = 'inbound-rtp';
export const OUTBOUND_RTP = 'outbound-rtp';
export const PACKETS_RECEIVED = 'packetsReceived';
export const PACKETS_SENT = 'packetsSent';
export const PACKETS_LOST = 'packetsLost';
export const PACKETS_DISCARDED = 'packetsDiscarded';
export const JITTER_BUFFER_DELAY = 'jitterBufferDelay';
export const JITTER_BUFFER_EMITTED_COUNT = 'jitterBufferEmittedCount';
export const TIMESTAMP = 'timestamp';
export const TYPE = 'type';
export const TRANSPORT = 'transport';
export const TARGET_BIT_RATE = 'targetBitrate';
export const MEDIA_SOURCE = 'media-source';
export const BYTES_RECEIVED = 'bytesReceived';
export const BYTES_SENT = 'bytesSent';
export const SELECTED_CANDIDATE_PAIR_ID = 'selectedCandidatePairId';
export const TOTAL_SAMPLES_DURATION = 'totalSamplesDuration';
export const RTP_RX_STAT = 'rtp-rxstat';
export const RTP_TX_STAT = 'rtp-txstat';
export const BASE_REG_TIMER_MFACTOR = 2;
export const BASE_REG_RETRY_TIMER_VAL_IN_SEC = 30;
export const SEC_TO_MSEC_MFACTOR = 1000;
export const MINUTES_TO_SEC_MFACTOR = 60;
export const REG_RANDOM_T_FACTOR_UPPER_LIMIT = 10000;
export const REG_TRY_BACKUP_TIMER_VAL_IN_SEC = 1200;
export const REG_TRY_BACKUP_TIMER_VAL_FOR_CC_IN_SEC = 114;
export const REG_FAILBACK_429_MAX_RETRIES = 5;
export const REGISTER_UTIL = 'registerDevice';
export const GET_MOBIUS_SERVERS_UTIL = 'getMobiusServers';
export const KEEPALIVE_UTIL = 'startKeepaliveTimer';
export const FAILBACK_UTIL = 'executeFailback';
export const FAILBACK_429_RETRY_UTIL = 'scheduleFailback429Retry';
export const FAILOVER_UTIL = 'startFailoverTimer';
export const NETWORK_CHANGE_DETECTION_UTIL = 'detectNetworkChange';
export const CALLS_CLEARED_HANDLER_UTIL = 'callsClearedHandler';
export const RECONNECT_UTIL = 'reconnectOnFailure';
export const NOISE_REDUCTION_EFFECT = 'noise-reduction-effect';
export const MOBIUS_US_PROD = 'mobius-us-east-1.prod.infra.webex.com';
export const MOBIUS_EU_PROD = 'mobius-eu-central-1.prod.infra.webex.com';
export const MOBIUS_US_INT = 'mobius-us-east-1.int.infra.webex.com';
export const MOBIUS_EU_INT = 'mobius-eu-central-1.int.infra.webex.com';
export const ICE_CANDIDATES_TIMEOUT = 3000;
