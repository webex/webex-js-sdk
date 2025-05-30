import LoggerProxy from '../common/logs/logger-proxy';
import ReconnectionPipeline from './reconnection-pipeline';

/**
 * MediaReconnectionPipeline class extends ReconnectionPipeline
 */
export default class MediaReconnectionPipeline extends ReconnectionPipeline {
  /**
   * Starts the media reconnection pipeline.
   *
   * @param {Object} options - Options for the reconnection.
   * @param {boolean} options.networkDisconnect - Indicates if the reconnection is due to a network disconnect.
   * @returns {Promise<void>}
   */
  startMediaReconnection(options = {networkDisconnect: false}): Promise<void> {
    return this.initializeReconnection()
      .then(() => this.startReachabilityCheck())
      .then(() => this.maybeStopLocalShareStream())
      .then(() => this.maybeReconnectMercuryWebSocket(options.networkDisconnect))
      .then(() => this.syncMeetings())
      .then(() => this.verifyMeetingState())
      .then(() => this.doTurnDiscovery())
      .then((iceServers) => this.waitForMediaReconnection(iceServers))
      .then(() => this.maybeResendMediaRequest())
      .catch((error) => {
        this.iceServersDefer.reject();

        LoggerProxy.logger.error(
          'MediaReconnectionPipeline#start --> Error during reconnection pipeline:',
          error
        );

        throw error;
      });
  }
}
