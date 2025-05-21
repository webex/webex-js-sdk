import {CC_FILE} from '../../../constants';
import {getErrorDetails} from '../../core/Utils';
import {TaskResponse} from '../types';
import Task from '../Task';

export default class Digital extends Task {
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
}
