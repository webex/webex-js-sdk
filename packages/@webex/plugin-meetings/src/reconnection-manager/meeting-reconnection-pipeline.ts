import LoggerProxy from '../common/logs/logger-proxy';
import ReconnectionPipeline from './reconnection-pipeline';

/**
 * MediaReconnectionPipeline class extends ReconnectionPipeline
 */
export default class MeetingReconnectionPipeline extends ReconnectionPipeline {
  /**
   * Starts the media reconnection pipeline.
   *
   * @param {Object} options - Options for the reconnection.
   * @param {boolean} options.networkDisconnect - Indicates if the reconnection is due to a network disconnect.
   *
   * @returns {Promise<void>}
   */
  startMeetingReconnection(): Promise<void> {
    return this.initializeReconnection()
      .then(() => this.rejoinMeeting())
      .then(() => this.maybeStopLocalShareStream())
      .then(() => this.doTurnDiscovery())
      .then((iceServers) => this.waitForMediaReconnection(iceServers))
      .then(() => this.maybeResendMediaRequest())
      .catch((error) => this.handleReconnectionError(error));
  }

  /**
   * Handles errors that occur during the meeting reconnection pipeline.
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
      'MeetingReconnectionPipeline#handleReconnectionError --> Error during reconnection pipeline'
    );

    throw error;
  }

  /**
   * Attempts to rejoin the meeting.
   *
   * @returns {Promise<void>}
   */
  private async rejoinMeeting(): Promise<void> {
    LoggerProxy.logger.info(
      'MeetingReconnectionPipeline#rejoinMeeting --> attempt to rejoin meeting'
    );

    return this.meeting.join({rejoin: true});
  }
}
