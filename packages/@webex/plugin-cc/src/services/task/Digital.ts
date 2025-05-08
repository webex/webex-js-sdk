import {CC_FILE} from '../../constants';
import {getErrorDetails} from '../core/Utils';
import routingContact from './contact';
import {TaskData, TaskResponse} from './types';
import Task, {TaskUIControls} from './Task';

export default class Digital extends Task {
  public getUIControls(): TaskUIControls {
    // Default UI controls for other media types
    return {
      showAcceptButton: true,
      showConferenceButton: true,
    };
  }

  protected contact: ReturnType<typeof routingContact>;
  constructor(contact: ReturnType<typeof routingContact>, data: TaskData) {
    super();
    this.contact = contact;
    this.data = data;
  }

  public isAcceptSupported(): boolean {
    return true;
  }

  public isConferenceSupported(): boolean {
    return !(
      this.data.interaction.mediaType === 'email' || this.data.interaction.mediaType === 'social'
    );
  }

  /**
   * This is used for incoming digital task accept by agent.
   *
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.accept().then(()=>{}).catch(()=>{})
   * ```
   */
  public async accept(): Promise<TaskResponse> {
    try {
      return this.contact.accept({interactionId: this.data.interactionId});
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'accept', CC_FILE);
      throw detailedError;
    }
  }

  //   public async conference(): Promise<TaskResponse> {
  //     try {
  //       return this.contact.conference({interactionId: this.data.interactionId});
  //     } catch (error) {
  //       const {error: detailedError} = getErrorDetails(error, 'accept', CC_FILE);
  //       throw detailedError;
  //     }
  //   }
}
