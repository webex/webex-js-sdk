import routingContact from './contact';
import WebCallingService from '../WebCallingService';
import Task from './Task';
import Voice from './voice/Voice';
import WebRTC from './voice/WebRTC';
import Digital from './digital/Digital';
import {MEDIA_CHANNEL, TaskData} from './types';

export default class TaskFactory {
  /**
   * Creates the correct Task subclass based on mediaType & loginOption
   */
  public static create(
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    data: TaskData
  ): Task {
    const mediaType = data.interaction.mediaType ?? MEDIA_CHANNEL.TELEPHONY;

    switch (mediaType) {
      case MEDIA_CHANNEL.TELEPHONY:
        if (webCallingService.loginOption === 'BROWSER') {
          return new WebRTC(contact, webCallingService, data);
        }

        return new Voice(contact, data);

      case MEDIA_CHANNEL.CHAT:
      case MEDIA_CHANNEL.EMAIL:
      case MEDIA_CHANNEL.SOCIAL:
        return new Digital(contact, data);

      default:
        throw new Error(`Unknown media type: ${mediaType}`);
    }
  }
}
