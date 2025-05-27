import routingContact from './contact';
import WebCallingService from '../WebCallingService';
import Task from './Task';
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
    configFlags: ConfigFlags
  ): Task {
    const mediaType = data.interaction.mediaType ?? MEDIA_CHANNEL.TELEPHONY;
    const {isEndCallEnabled, isEndConsultEnabled} = configFlags;

    switch (mediaType) {
      case MEDIA_CHANNEL.TELEPHONY:
        if (webCallingService.loginOption === 'BROWSER') {
          return new WebRTC(contact, webCallingService, data);
        }

        return new Voice(contact, data, {
          isEndCallEnabled,
          isEndConsultEnabled,
        });

      case MEDIA_CHANNEL.CHAT:
      case MEDIA_CHANNEL.EMAIL:
      case MEDIA_CHANNEL.SOCIAL:
        return new Digital(contact, data);

      default:
        throw new Error(`Unknown media type: ${mediaType}`);
    }
  }
}
