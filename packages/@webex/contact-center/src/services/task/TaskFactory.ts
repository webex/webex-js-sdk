import routingContact from './contact';
import WebCallingService from '../WebCallingService';
import Task from './Task';
import Voice from './voice/Voice';
import WebRTC from './voice/WebRTC';
import Digital from './digital/Digital';
import {MEDIA_CHANNEL, TaskData} from './types';
import {ConfigFlags, LoginOption} from '../../types';
import {WrapupData} from '../config/types';

export default class TaskFactory {
  /**
   * Creates the correct Task subclass based on mediaType & loginOption
   */
  public static createTask(
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    data: TaskData,
    configFlags: ConfigFlags,
    wrapupData?: WrapupData,
    agentId?: string
  ): Task {
    const mediaType = data.interaction.mediaType ?? MEDIA_CHANNEL.TELEPHONY;
    const {isEndTaskEnabled, isEndConsultEnabled} = configFlags;
    const recordingEnabled = data?.interaction?.callProcessingDetails?.pauseResumeEnabled ?? true;
    const voiceControlOptions = {
      isEndTaskEnabled,
      isEndConsultEnabled,
      isRecordingEnabled: recordingEnabled,
    };
    switch (mediaType) {
      case MEDIA_CHANNEL.TELEPHONY:
        if (webCallingService.loginOption === LoginOption.BROWSER) {
          return new WebRTC(
            contact,
            webCallingService,
            data,
            voiceControlOptions,
            wrapupData,
            agentId
          );
        }

        return new Voice(contact, data, voiceControlOptions, wrapupData, agentId);

      case MEDIA_CHANNEL.CHAT:
      case MEDIA_CHANNEL.EMAIL:
      case MEDIA_CHANNEL.SOCIAL:
        return new Digital(contact, data, wrapupData, agentId);

      default:
        throw new Error(`Unknown media type: ${mediaType}`);
    }
  }
}
