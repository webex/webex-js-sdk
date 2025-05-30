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
   * @returns {Promise<void>}
   */
  startMeetingReconnection(): Promise<void> {
    return this.initializeReconnection()
      .then(() => this.rejoinMeeting())
      .then(() => this.maybeStopLocalShareStream())
      .then(() => this.doTurnDiscovery())
      .then((iceServers) => this.waitForMediaReconnection(iceServers))
      .then(() => this.maybeResendMediaRequest())
      .catch((error) => {
        this.iceServersDefer.reject();

        LoggerProxy.logger.error(
          'MeetingReconnectionPipeline#start --> Error during reconnection pipeline:',
          error
        );

        throw error;
      });
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
