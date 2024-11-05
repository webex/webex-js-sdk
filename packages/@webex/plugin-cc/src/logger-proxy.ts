import {Logger} from './types';

export default class LoggerProxy {
  public static logger: Logger;
  private static instance: LoggerProxy;
  private constructor(logger: Logger) {
    LoggerProxy.logger = logger;
  }

  public static initialize(logger: any): void {
    if (!LoggerProxy.instance) {
      LoggerProxy.instance = new LoggerProxy(logger);
    }
  }
}
