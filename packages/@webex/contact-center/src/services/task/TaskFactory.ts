import routingContact from './contact';
import WebCallingService from '../WebCallingService';
import Task, {TaskRuntimeOptions} from './Task';
import Voice from './voice/Voice';
import WebRTC from './voice/WebRTC';
import Digital from './digital/Digital';
import {MEDIA_CHANNEL, TaskData} from './types';
import {ConfigFlags} from '../../types';

export default class TaskFactory {
  /**
   * Creates the correct Task subclass based on mediaType & loginOption
   */
  public static createTask(
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    data: TaskData,
    configFlags: ConfigFlags,
    runtimeOptions: TaskRuntimeOptions = {}
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
        if (webCallingService.loginOption === 'BROWSER') {
          return new WebRTC(contact, webCallingService, data, voiceControlOptions, runtimeOptions);
        }

        return new Voice(contact, data, voiceControlOptions, runtimeOptions);

      case MEDIA_CHANNEL.CHAT:
      case MEDIA_CHANNEL.EMAIL:
      case MEDIA_CHANNEL.SOCIAL:
        return new Digital(contact, data, runtimeOptions);

      default:
        throw new Error(`Unknown media type: ${mediaType}`);
    }
  }
}
