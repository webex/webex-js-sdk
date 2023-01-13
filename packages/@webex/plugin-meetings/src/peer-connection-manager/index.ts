// We need to figure out how to pass a webex logger instance to these util files

/* globals RTCSessionDescription */

import window from 'global/window';
import sdpTransform from 'sdp-transform'; // https://github.com/clux/sdp-transform

import Metrics from '../metrics';
import LoggerProxy from '../common/logs/logger-proxy';
import StaticConfig from '../common/config';
import {
  COMPLETE,
  GATHERING,
  AUDIO,
  SDP,
  ICE_STATE,
  CONNECTION_STATE,
  NETWORK_STATUS,
  PEER_CONNECTION_STATE,
  OFFER,
  QUALITY_LEVELS,
  REMOTE_VIDEO_CONSTRAINTS,
} from '../constants';
import BEHAVIORAL_METRICS from '../metrics/constants';
import {error, eventType} from '../metrics/config';
import MediaError from '../common/errors/media';
import ParameterError from '../common/errors/parameter';
import {InvalidSdpError} from '../common/errors/webex-errors';
import BrowserDetection from '../common/browser-detection';

import PeerConnectionUtils from './util';

const {isBrowser} = BrowserDetection();

/**
 * @export
 * @public
 */
const pc: any = {};

/**
 * munges the bandwidth limit into the sdp
 * @param {String} sdpLines
 * @param {Number} index
 * @returns {String}
 */
const insertBandwidthLimit = (sdpLines: any, index: number) => {
  // eslint-disable-next-line no-warning-comments
  // TODO convert to sdp parser
  let limit;
  let periodicKeyFrame = '';

  if (sdpLines[index].search(AUDIO) !== -1) {
    limit = StaticConfig.meetings.bandwidth.audio;
  } else {
    limit = StaticConfig.meetings.bandwidth.video;
    periodicKeyFrame = SDP.PERIODIC_KEYFRAME;
    sdpLines.splice(index + 2, 0, periodicKeyFrame);
  }
  sdpLines.splice(index + 1, 0, `${SDP.B_LINE}:${limit}`);

  return sdpLines;
};

/**
 * needed for calliope max-fs
 * @param {String} sdp
 * @param {String} [level=QUALITY_LEVELS.HIGH] quality level for max-fs
 * @returns {String}
 */
const setRemoteVideoConstraints = (sdp: string, level: string = QUALITY_LEVELS.HIGH) => {
  const maxFs = REMOTE_VIDEO_CONSTRAINTS.MAX_FS[level];

  if (!maxFs) {
    throw new ParameterError(
      `setRemoteVideoConstraints: unable to set max framesize, value for level "${level}" is not defined`
    );
  }

  const modifiedSdp = PeerConnectionUtils.adjustH264Profile(sdp, maxFs);

  return modifiedSdp;
};

const setStartBitrateOnRemoteSdp = (sdp) => {
  if (StaticConfig.meetings.bandwidth.startBitrate) {
    sdp = sdp.replace(
      /(\na=fmtp:(\d+).*profile-level-id=.*)/gi,
      `$1;x-google-start-bitrate=${StaticConfig.meetings.bandwidth.startBitrate}`
    );
  }

  return sdp;
};

/**
 * checks that sdp has h264 codec in it
 * @param {String} sdp
 * @returns {boolean}
 */
const checkH264Support = (sdp: string) => {
  // eslint-disable-next-line no-warning-comments
  // TODO convert to sdp parser to read rtp.codec
  const videoPresent = sdp.match(/\nm=video.*/g);
  const h264Present = sdp.match(/\na=rtpmap:\d+\sH264.*/g);

  if (videoPresent) {
    return !!h264Present;
  }

  return true;
};

/**
 * validates the sdp, checks port, candidates, and ice info
 * @param {String} sdp
 * @returns {String}
 */
const isSdpInvalid = (sdp: string) => {
  const parsedSdp = sdpTransform.parse(sdp);

  for (const mediaLine of parsedSdp.media) {
    if (!mediaLine.candidates || mediaLine.candidates?.length === 0) {
      LoggerProxy.logger.error(
        'PeerConnectionManager:index#isSdpInvalid --> iceCandidate: Ice candidate never completed'
      );

      return 'iceCandidate: Ice gathering never completed';
    }

    if (SDP.BAD_MEDIA_PORTS.includes(mediaLine.port)) {
      LoggerProxy.logger.error(
        'PeerConnectionManager:index#isSdpInvalid --> iceCandidate: Found invalid port number for the ice candidate'
      );

      return 'iceCandidate: Found invalid port number for the ice candidate';
    }
    if (!mediaLine.icePwd || !mediaLine.iceUfrag) {
      LoggerProxy.logger.error(
        'PeerConnectionManager:index#isSdpInvalid --> iceCandidate: ice ufrag and password not found'
      );

      return 'iceCandidate: ice ufrag and password not found';
    }
  }

  return '';
};

/**
 * munges the bandwidth into the sdp
 * @param {String} sdp
 * @returns {String}
 */
const limitBandwidth = (sdp: string) => {
  // TODO convert to sdp parser
  let offerSdp = sdp;
  let sdpLines = offerSdp.split(SDP.CARRIAGE_RETURN);

  for (let i = 0; i < sdpLines.length; i += 1) {
    if (sdpLines[i].search(SDP.M_LINE) !== -1) {
      sdpLines = insertBandwidthLimit(sdpLines, i);
    }
  }
  offerSdp = sdpLines.join(SDP.CARRIAGE_RETURN);

  return offerSdp;
};

/**
 * makes sure the screen pc sdp has content:slides for server
 * @param {RTCPeerConnection} screenPc
 * @returns {RTCPeerConnection}
 */
pc.setContentSlides = (screenPc: any) => {
  if (screenPc && screenPc.sdp) {
    screenPc.sdp += `${SDP.A_CONTENT_SLIDES}${SDP.CARRIAGE_RETURN}`;
  }

  return screenPc;
};

/**
 * handles ice trickling and establishes ICE connection onto peer connection object
 * @param {Object} peerConnection
 * @param {Object} options
 * @param {String} options.remoteQualityLevel
 * @returns {Promise.RTCPeerConnection}
 */
pc.iceCandidate = (
  peerConnection: any,
  {
    remoteQualityLevel,
  }: {
    remoteQualityLevel: string;
  }
) =>
  new Promise<void>((resolve, reject) => {
    const now = Date.now();
    const doneGatheringIceCandidate = () => {
      // @ts-ignore
      const miliseconds = parseInt(Math.abs(Date.now() - now), 4);

      peerConnection.sdp = limitBandwidth(peerConnection.localDescription.sdp);
      peerConnection.sdp = PeerConnectionUtils.convertCLineToIpv4(peerConnection.sdp);
      peerConnection.sdp = setRemoteVideoConstraints(peerConnection.sdp, remoteQualityLevel);

      const invalidSdpPresent = isSdpInvalid(peerConnection.sdp);

      if (invalidSdpPresent) {
        LoggerProxy.logger.error(
          'PeerConnectionManager:index#iceCandidate --> SDP not valid after waiting.'
        );
        reject(new InvalidSdpError(invalidSdpPresent));
      }
      LoggerProxy.logger.log(
        `PeerConnectionManager:index#iceCandidate --> Time to gather ice candidate ${miliseconds} miliseconds`
      );

      resolve();
    };

    // If ice has already been gathered
    if (peerConnection.iceGatheringState === COMPLETE) {
      doneGatheringIceCandidate();
    }

    peerConnection.onIceGatheringStateChange = () => {
      if (peerConnection.iceGatheringState === COMPLETE) {
        // @ts-ignore
        doneGatheringIceCandidate(peerConnection);
      }
      if (peerConnection.iceGatheringState === GATHERING) {
        LoggerProxy.logger.log(
          'PeerConnectionManager:index#onIceGatheringStateChange --> Ice state changed to gathering'
        );
      }
    };

    peerConnection.onicecandidate = (evt) => {
      if (evt.candidate === null) {
        // @ts-ignore
        doneGatheringIceCandidate(peerConnection);
      } else {
        LoggerProxy.logger.log(
          `PeerConnectionManager:index#onicecandidate --> Candidate ${evt.candidate?.type} ${evt.candidate?.protocol} ${evt.candidate?.address}:${evt.candidate?.port}`
        );
      }
    };

    peerConnection.onicecandidateerror = (event) => {
      // we can often get ICE candidate errors (for example when failing to communicate with a TURN server)
      // they don't mean that the whole ICE connection will fail, so it's OK to ignore them
      LoggerProxy.logger.error(
        'PeerConnectionManager:index#onicecandidateerror --> ignoring ice error:',
        event
      );
    };
  });

/**
 * swapping tracks
 * @param {Object} peerConnection
 * @param {Object} track
 * @returns {undefined}
 */
pc.replaceTrack = (peerConnection: any, track: any) => {
  try {
    const senders = peerConnection.getSenders();

    if (senders.length > 0) {
      senders.forEach((sender) => {
        if (sender.track && sender.track.kind === track.kind) {
          sender.replaceTrack(track);
        }
      });
    }
  } catch (err) {
    LoggerProxy.logger.error(
      `PeerConnectionManager:index#replaceTrack --> Error replacing track, ${err}`
    );
  }
};

/**
 * adding streams to peerConnection
 * @param {Object} peerConnection
 * @param {Object} stream
 * @returns {undefined}
 */
pc.addStream = (peerConnection: any, stream: any) => {
  try {
    if (stream && !isBrowser('edge')) {
      const tracksPresent =
        peerConnection.getSenders &&
        peerConnection.getSenders().find((sender) => sender.track != null);

      if (tracksPresent) {
        stream.getTracks().forEach((track) => {
          pc.replaceTrack(peerConnection, track);
        });

        return;
      }
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });
      // // TODO : may come back disable addTracks for chrome they are moving back to addStream
      // // https://bugs.chromium.org/p/chromium/issues/detail?id=764414
      // // https://bugs.chromium.org/p/chromium/issues/detail?id=738918#c7
      //   peerConnection.addStream(stream);
    } else if (isBrowser('edge')) {
      peerConnection.addStream(stream);
    }
  } catch (err) {
    LoggerProxy.logger.error(
      `PeerConnectionManager:index#addStream --> Error adding stream, error: ${error}`
    );
  }
};

/**
 * setting the remote description
 * @param {Object} peerConnection
 * @param {String} typeStr
 * @param {String} remoteSdp
 * @param {String} meetingId
 * @returns {undefined}
 */
pc.setRemoteSessionDetails = (
  peerConnection: any,
  typeStr: string,
  remoteSdp: string,
  meetingId: string
) => {
  LoggerProxy.logger.log(
    `PeerConnectionManager:index#setRemoteSessionDetails --> Setting the remote description type: ${typeStr}State: ${peerConnection.signalingState}`
  );
  let sdp = remoteSdp;

  // making sure that the remoteDescription is only set when there is a answer for offer
  // or there is a offer from the server

  if (!sdp) {
    Metrics.postEvent({
      event: eventType.REMOTE_SDP_RECEIVED,
      meetingId,
      data: {
        canProceed: false,
        errors: [
          Metrics.generateErrorPayload(2001, true, error.name.MEDIA_ENGINE, 'missing remoteSdp'),
        ],
      },
    });
  }
  if (
    peerConnection.signalingState === SDP.HAVE_LOCAL_OFFER ||
    (peerConnection.signalingState === SDP.STABLE && typeStr === SDP.OFFER)
  ) {
    sdp = setStartBitrateOnRemoteSdp(sdp);

    if (!peerConnection.enableExtmap) {
      sdp = sdp.replace(/\na=extmap.*/g, '');
    }

    // remove any xtls candidates
    sdp = sdp.replace(/^a=candidate:.*xTLS.*\r\n/gim, '');

    return (
      peerConnection
        .setRemoteDescription(
          new window.RTCSessionDescription({
            type: typeStr,
            sdp,
          })
        )
        .then(() => {
          if (peerConnection.signalingState === SDP.STABLE) {
            Metrics.postEvent({
              event: eventType.REMOTE_SDP_RECEIVED,
              meetingId,
            });
          }
        })
        // eslint-disable-next-line @typescript-eslint/no-shadow
        .catch((error) => {
          LoggerProxy.logger.error(
            `Peer-connection-manager:index#setRemoteDescription --> ${error} missing remotesdp`
          );

          const metricName = BEHAVIORAL_METRICS.PEERCONNECTION_FAILURE;
          const data = {
            correlation_id: meetingId,
            reason: error.message,
            stack: error.stack,
          };
          const metadata = {
            type: error.name,
          };

          Metrics.sendBehavioralMetric(metricName, data, metadata);

          return Metrics.postEvent({
            event: eventType.REMOTE_SDP_RECEIVED,
            meetingId,
            data: {
              canProceed: false,
              errors: [
                Metrics.generateErrorPayload(
                  2001,
                  true,
                  error.name.MEDIA_ENGINE,
                  'missing remoteSdp'
                ),
              ],
            },
          });
        })
    );
  }

  return Promise.reject(new MediaError('PeerConnection in wrong state'));
};

/**
 * Create offer with a valid parameter
 * @param {Object} peerConnection
 * @param {Object} meetingProperties
 * @param {string} meetingProperties.meetingId
 * @param {string} meetingProperties.remoteQualityLevel LOW|MEDIUM|HIGH
 * @param {string} meetingProperties.enableRtx
 * @param {string} meetingProperties.enableExtmap
 * @returns {RTCPeerConnection}
 */
pc.createOffer = (
  peerConnection: any,
  {
    meetingId,
    remoteQualityLevel,
    enableRtx,
    enableExtmap,
  }: {
    meetingId: string;
    remoteQualityLevel: string;
    enableRtx: string;
    enableExtmap: string;
  }
) => {
  LoggerProxy.logger.log('PeerConnectionManager:index#createOffer --> creating a new offer');

  // saving the extMap State to use in setRemoteDescription

  peerConnection.enableExtmap = enableExtmap;

  return (
    peerConnection
      .createOffer()
      .then((description) => {
        // bug https://bugs.chromium.org/p/chromium/issues/detail?id=1020642
        // chrome currently generates RTX line irrespective of whether the server side supports it
        // we are removing apt as well because its associated with rtx line

        if (!enableRtx) {
          description.sdp = description.sdp.replace(/\r\na=rtpmap:\d+ rtx\/\d+/g, '');
          description.sdp = description.sdp.replace(/\r\na=fmtp:\d+ apt=\d+/g, '');
        }

        return peerConnection.setLocalDescription(description);
      })
      .then(() => pc.iceCandidate(peerConnection, {remoteQualityLevel}))
      .then(() => {
        if (!checkH264Support(peerConnection.sdp)) {
          throw new MediaError(
            'openH264 is downloading please Wait. Upload logs if not working on second try'
          );
        }

        if (!enableExtmap) {
          peerConnection.sdp = peerConnection.sdp.replace(/\na=extmap.*/g, '');
        }

        pc.setContentSlides(peerConnection);

        Metrics.postEvent({
          event: eventType.LOCAL_SDP_GENERATED,
          meetingId,
        });

        return peerConnection;
      })
      // eslint-disable-next-line @typescript-eslint/no-shadow
      .catch((error) => {
        LoggerProxy.logger.error(`Peer-connection-manager:index#createOffer --> ${error}`);
        if (error instanceof InvalidSdpError) {
          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.INVALID_ICE_CANDIDATE, {
            correlation_id: meetingId,
            code: error.code,
            reason: error.message,
          });
        } else {
          const metricName = BEHAVIORAL_METRICS.PEERCONNECTION_FAILURE;
          const data = {
            correlation_id: meetingId,
            reason: error.message,
            stack: error.stack,
          };
          const metadata = {
            type: error.name,
          };

          Metrics.sendBehavioralMetric(metricName, data, metadata);
        }

        Metrics.postEvent({
          event: eventType.LOCAL_SDP_GENERATED,
          meetingId,
          data: {
            canProceed: false,
            errors: [
              // @ts-ignore
              Metrics.generateErrorPayload(2001, true, error.name.MEDIA_ENGINE),
            ],
          },
        });
        pc.close(peerConnection);
        throw error;
      })
  );
};

/**
 * rollBack local description in peerconnection
 * @param {Object} peerConnection
 * @returns {Promise.RTCPeerConnection}
 */
pc.rollBackLocalDescription = (peerConnection: any) =>
  peerConnection
    // @ts-ignore
    .setLocalDescription(new RTCSessionDescription({type: SDP.ROLLBACK}))
    .then(() => peerConnection)
    .catch((err) => {
      LoggerProxy.logger.error(`Peer-connection-manager:index#setLocalDescription --> ${err} `);

      // @ts-ignore
      return Promise.error(err);
    });

/**
 * @param {Object} params {
 * @param {Boolean} params.offerToReceiveAudio
 * @param {Boolean} params.offerToReceiveVideo
 * @param {string} params.offerSdp
 * @param {MediaStream} params.stream
 * @param {Object} meetingProperties
 * @param {string} meetingProperties.meetingId
 * @param {string} meetingProperties.remoteQualityLevel LOW|MEDIUM|HIGH
 * @returns {Promise.<Array>} [MediaSDP, ScreenSDP]
 */
pc.updatePeerConnection = (
  params: {
    offerToReceiveAudio: boolean;
    offerToReceiveVideo: boolean;
    offerSdp: string;
    stream: MediaStream;
    peerConnection: any;
  },
  {
    meetingId,
    remoteQualityLevel,
  }: {
    meetingId: string;
    remoteQualityLevel: string;
  }
) => {
  LoggerProxy.logger.log(
    `PeerConnectionManager:index#updatePeerConnection --> updating the peerConnection with params: ${params}`
  );

  const {peerConnection, offerSdp} = params;

  return pc
    .createAnswer(
      {
        peerConnection,
        offerSdp: offerSdp[0],
      },
      {meetingId, remoteQualityLevel}
    )
    .then((peerconnection) => {
      // The content slides should also be set when we are sending inactive
      pc.setContentSlides(peerconnection);

      return Promise.resolve([peerconnection.sdp]);
    });
};

/**
 * @param {Object} params
 * @param {Object} params.peerConnection
 * @param {Object} params.sdpConstraints
 * @param {Object} meetingProperties
 * @param {string} meetingProperties.meetingId
 * @param {string} meetingProperties.remoteQualityLevel LOW|MEDIUM|HIGH
 * @returns {RTCPeerConnection} peerConnection
 */
pc.createAnswer = (
  params: {
    peerConnection: any;
    sdpConstraints: object;
    offerSdp: any;
  },
  {
    meetingId,
    remoteQualityLevel,
  }: {
    meetingId: string;
    remoteQualityLevel: string;
  }
) => {
  const {peerConnection} = params;

  // TODO: Some times to many mercury event comes at the same time
  // Need to maintain state of peerconnection
  if (peerConnection.signalingState === SDP.HAVE_REMOTE_OFFER) {
    return Promise.resolve(peerConnection);
  }

  return (
    pc
      .setRemoteSessionDetails(peerConnection, OFFER, params.offerSdp, meetingId)
      .then(() => peerConnection.createAnswer(params.sdpConstraints))
      .then((answer) => peerConnection.setLocalDescription(answer))
      .then(() => pc.iceCandidate(peerConnection, {remoteQualityLevel}))
      .then(() => {
        peerConnection.sdp = limitBandwidth(peerConnection.localDescription.sdp);
        peerConnection.sdp = PeerConnectionUtils.convertCLineToIpv4(peerConnection.sdp);
        peerConnection.sdp = setRemoteVideoConstraints(peerConnection.sdp, remoteQualityLevel);

        if (!checkH264Support(peerConnection.sdp)) {
          throw new MediaError(
            'openH264 is downloading please Wait. Upload logs if not working on second try'
          );
        }

        return peerConnection;
      })
      // eslint-disable-next-line @typescript-eslint/no-shadow
      .catch((error) => {
        if (error instanceof InvalidSdpError) {
          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.INVALID_ICE_CANDIDATE, {
            correlation_id: meetingId,
          });
        } else {
          const metricName = BEHAVIORAL_METRICS.PEERCONNECTION_FAILURE;
          const data = {
            correlation_id: meetingId,
            reason: error.message,
            stack: error.stack,
          };
          const metadata = {
            type: error.name,
          };

          Metrics.sendBehavioralMetric(metricName, data, metadata);
        }

        LoggerProxy.logger.error(
          `PeerConnectionManager:index#setRemoteSessionDetails --> Error creating remote session, error: ${error}`
        );
      })
  );
};

/**
 * shut down the peer connection
 * @param {Object} peerConnection
 * @returns {undefined}
 */
pc.close = (peerConnection: any) => {
  // peerConnection.close() fails on firefox on network changes and gives a Dom exception
  // To avoid this we have added a try catch block.
  // Please refer to https://bugzilla.mozilla.org/show_bug.cgi?id=1274407 for more information
  LoggerProxy.logger.log(
    'PeerConnectionManager:index#close --> pc: close() -> attempting to close the peer connection'
  );

  if (peerConnection && peerConnection.connectionState === PEER_CONNECTION_STATE.CLOSED) {
    LoggerProxy.logger.log(
      'PeerConnectionManager:index#close --> pc: close() -> connection already closed'
    );

    return Promise.resolve();
  }
  LoggerProxy.logger.log(
    'PeerConnectionManager:index#close --> pc: close() -> closing the mediaPeerConnection'
  );

  return Promise.resolve().then(() => {
    if (peerConnection && peerConnection.close) {
      peerConnection.close();
    }
  });
};

pc.setPeerConnectionEvents = (meeting) => {
  // In case ICE fail
  const {peerConnection} = meeting.mediaProperties;

  const connectionFailed = () => {
    if (meeting.reconnectionManager.iceState.resolve) {
      // DISCONNECTED state triggers first then it goes to FAILED STATE
      // sometimes the failed state can happen before 10 seconds (Which is the timer for the reconnect for ice disconnect)
      meeting.reconnectionManager.iceState.resolve();
    }

    meeting.reconnect({networkDisconnect: true});
    Metrics.postEvent({
      event: eventType.ICE_END,
      meeting,
      data: {
        canProceed: false,
        errors: [
          // @ts-ignore
          Metrics.generateErrorPayload(2004, false, error.name.MEDIA_ENGINE),
        ],
      },
    });

    meeting.uploadLogs({
      file: 'peer-connection-manager/index',
      function: 'connectionFailed',
    });

    Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.CONNECTION_FAILURE, {
      correlation_id: meeting.correlationId,
      locus_id: meeting.locusId,
    });
  };

  peerConnection.oniceconnectionstatechange = () => {
    LoggerProxy.logger.info(
      'PeerConnectionManager:index#setPeerConnectionEvents --> ICE STATE CHANGE.'
    );
    switch (peerConnection.iceConnectionState) {
      case ICE_STATE.CHECKING:
        LoggerProxy.logger.info(
          'PeerConnectionManager:index#setPeerConnectionEvents --> ICE STATE CHECKING.'
        );
        Metrics.postEvent({event: eventType.ICE_START, meeting});
        break;
      case ICE_STATE.COMPLETED:
        LoggerProxy.logger.info(
          'PeerConnectionManager:index#setPeerConnectionEvents --> ICE STATE COMPLETED.'
        );
        break;
      case ICE_STATE.CONNECTED:
        // Ice connection state goes to connected when both client and server sends STUN packets and
        // Established connected between them. Firefox does not trigger COMPLETED and only trigger CONNECTED
        Metrics.postEvent({event: eventType.ICE_END, meeting});
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.CONNECTION_SUCCESS, {
          correlation_id: meeting.correlationId,
          locus_id: meeting.locusId,
        });
        meeting.setNetworkStatus(NETWORK_STATUS.CONNECTED);
        meeting.reconnectionManager.iceReconnected();
        LoggerProxy.logger.info(
          'PeerConnectionManager:index#setPeerConnectionEvents --> ICE STATE CONNECTED.'
        );
        break;
      case ICE_STATE.CLOSED:
        LoggerProxy.logger.info(
          'PeerConnectionManager:index#setPeerConnectionEvents --> ICE STATE CLOSED.'
        );
        break;
      case ICE_STATE.DISCONNECTED:
        meeting.setNetworkStatus(NETWORK_STATUS.DISCONNECTED);
        meeting.reconnectionManager.waitForIceReconnect().catch(() => {
          LoggerProxy.logger.info(
            'PeerConnectionManager:index#setPeerConnectionEvents --> ICE STATE DISCONNECTED. Automatic Reconnection Timed Out.'
          );

          connectionFailed();
        });
        LoggerProxy.logger.info(
          'PeerConnectionManager:index#setPeerConnectionEvents --> ICE STATE DISCONNECTED.'
        );
        break;
      case ICE_STATE.FAILED:
        LoggerProxy.logger.info(
          'PeerConnectionManager:index#setPeerConnectionEvents --> ICE STATE FAILED.'
        );
        // notify of ice failure
        // Ice failure is the only indicator currently for identifying the actual connection drop
        // Firefox takes sometime 10-15 seconds to go to failed state
        connectionFailed();
        break;
      default:
        break;
    }
  };

  peerConnection.onconnectionstatechange = () => {
    LoggerProxy.logger.info(
      'PeerConnectionManager:index#setPeerConnectionEvents --> CONNECTION STATE CHANGE.'
    );
    switch (peerConnection.connectionState) {
      case CONNECTION_STATE.NEW:
        LoggerProxy.logger.info(
          'PeerConnectionManager:index#setPeerConnectionEvents --> CONNECTION STATE NEW.'
        );
        break;
      case CONNECTION_STATE.CONNECTING:
        LoggerProxy.logger.info(
          'PeerConnectionManager:index#setPeerConnectionEvents --> CONNECTION STATE CONNECTING.'
        );
        break;
      case CONNECTION_STATE.CONNECTED:
        LoggerProxy.logger.info(
          'PeerConnectionManager:index#setPeerConnectionEvents --> CONNECTION STATE CONNECTED.'
        );
        break;
      case CONNECTION_STATE.CLOSED:
        LoggerProxy.logger.info(
          'PeerConnectionManager:index#setPeerConnectionEvents --> CONNECTION STATE CLOSED.'
        );
        break;
      case CONNECTION_STATE.DISCONNECTED:
        LoggerProxy.logger.info(
          'PeerConnectionManager:index#setPeerConnectionEvents --> CONNECTION STATE DISCONNECTED.'
        );
        break;
      case CONNECTION_STATE.FAILED:
        LoggerProxy.logger.info(
          'PeerConnectionManager:index#setPeerConnectionEvents --> CONNECTION STATE FAILED.'
        );
        // Special case happens only on chrome where there is no ICE FAILED event
        // only CONNECTION FAILED event gets triggered

        connectionFailed();
        break;
      default:
        break;
    }
  };
};

export default pc;
