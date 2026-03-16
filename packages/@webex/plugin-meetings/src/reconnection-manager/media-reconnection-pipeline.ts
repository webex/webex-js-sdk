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
   *
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
      .catch((error) => this.handleReconnectionError(error));
  }

  /**
   * Handles errors that occur during the media reconnection pipeline.
   *
   * @param {Error} error - The error that occurred during the reconnection pipeline.
   *
   * @throws {Error} - Throws the error after logging it.
   *
   * @returns {void}
   */
  private handleReconnectionError(error: Error): void {
    this.cleanupOnError();

    LoggerProxy.logger.error(
      'MediaReconnectionPipeline#handleReconnectionError --> Error during reconnection pipeline'
    );

    throw error;
  }
}
