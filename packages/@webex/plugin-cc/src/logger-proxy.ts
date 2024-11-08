import {Logger} from './types';

export default class LoggerProxy {
  public static logger: Logger;

  public static initialize(logger: Logger): void {
    LoggerProxy.logger = logger;
  }
}
