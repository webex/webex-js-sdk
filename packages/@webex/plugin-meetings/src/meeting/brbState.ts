import {MediaType} from '@webex/internal-media-core';
import LoggerProxy from '../common/logs/logger-proxy';
import type Meeting from '.';
import SendSlotManager from '../multistream/sendSlotManager';

export const createBrbState = (meeting: Meeting, enabled: boolean) => {
  LoggerProxy.logger.info(
    `Meeting:brbState#createBrbState: creating BrbState for meeting id ${meeting?.id}`
  );

  const brbState = new BrbState(meeting, enabled);

  return brbState;
};

/** The purpose of this class is to manage the local and remote brb state
 * and make sure that the server state always matches the last requested state by the client.
 */
export class BrbState {
  state: {
    client: {
      enabled: boolean;
    };
    server: {
      enabled: boolean;
    };
    syncToServerInProgress: boolean;
  };

  meeting: Meeting;

  /**
   * Constructor
   *
   * @param {Meeting} meeting - the meeting object
   * @param {boolean} enabled - whether the client audio/video is enabled at all
   */
  constructor(meeting: Meeting, enabled: boolean) {
    this.meeting = meeting;
    this.state = {
      client: {
        enabled,
      },
      server: {
        enabled: false,
      },
      syncToServerInProgress: false,
    };
  }

  /**
   * Enables/disables brb
   *
   * @param {boolean} enabled
   * @param {SendSlotManager} sendSlotManager
   * @returns {Promise}
   */
  public enable(enabled: boolean, sendSlotManager: SendSlotManager) {
    this.state.client.enabled = enabled;

    return this.applyClientStateToServer(sendSlotManager);
  }

  /**
   * Updates the server local and remote brb values so that they match the current client desired state.
   *
   * @param {SendSlotManager} sendSlotManager
   * @returns {Promise}
   */
  private applyClientStateToServer(sendSlotManager: SendSlotManager) {
    if (this.state.syncToServerInProgress) {
      LoggerProxy.logger.info(
        `Meeting:brbState#applyClientStateToServer: request to server in progress, we need to wait for it to complete`
      );

      return Promise.resolve();
    }

    const remoteBrbRequiresSync = this.state.client.enabled !== this.state.server.enabled;

    LoggerProxy.logger.info(
      `Meeting:brbState#applyClientStateToServer: remoteBrbRequiresSync: ${remoteBrbRequiresSync}`
    );

    if (!remoteBrbRequiresSync) {
      LoggerProxy.logger.info(
        `Meeting:brbState#applyClientStateToServer: client state already matching server state, nothing to do`
      );

      return Promise.resolve();
    }

    this.state.syncToServerInProgress = true;

    return this.sendLocalBrbStateToServer(sendSlotManager)
      .then(() => {
        this.state.syncToServerInProgress = false;
        LoggerProxy.logger.info(
          `Meeting:brbState#applyClientStateToServer: sync with server completed`
        );

        // need to check if a new sync is required, because this.state.client may have changed while we were doing the current sync
        this.applyClientStateToServer(sendSlotManager);
      })
      .catch((e) => {
        this.state.syncToServerInProgress = false;
        LoggerProxy.logger.warn(`Meeting:brbState#applyClientStateToServer: error: ${e}`);
      });
  }

  /**
   * Send the local brb state to the server
   *
   * @param {SendSlotManager} sendSlotManager
   * @returns {Promise}
   */
  private async sendLocalBrbStateToServer(sendSlotManager: SendSlotManager) {
    const {enabled} = this.state.client;

    if (!this.meeting.isMultistream) {
      const errorMessage = 'Meeting:brbState#sendLocalBrbStateToServer: Not a multistream meeting';
      const error = new Error(errorMessage);

      LoggerProxy.logger.error(error);

      return Promise.reject(error);
    }

    if (!this.meeting.mediaProperties.webrtcMediaConnection) {
      const errorMessage =
        'Meeting:brbState#sendLocalBrbStateToServer: WebRTC media connection is not defined';
      const error = new Error(errorMessage);

      LoggerProxy.logger.error(error);

      return Promise.reject(error);
    }

    // this logic should be applied only to multistream meetings
    return this.meeting.meetingRequest
      .setBrb({
        enabled,
        locusUrl: this.meeting.locusUrl,
        deviceUrl: this.meeting.deviceUrl,
        selfId: this.meeting.selfId,
      })
      .then(() => {
        sendSlotManager.setSourceStateOverride(MediaType.VideoMain, enabled ? 'away' : null);
      })
      .catch((error) => {
        LoggerProxy.logger.error('Meeting:brbState#sendLocalBrbStateToServer: Error ', error);

        return Promise.reject(error);
      });
  }

  /**
   * This method should be called whenever the server brb state is changed
   *
   * @param {Boolean} [enabled] true if user has brb enabled, false otherwise
   * @returns {undefined}
   */
  public handleServerBrbUpdate(enabled?: boolean) {
    LoggerProxy.logger.info(
      `Meeting:brbState#handleServerBrbUpdate: updating server brb to (${enabled})`
    );
    this.state.server.enabled = !!enabled;
  }
}
