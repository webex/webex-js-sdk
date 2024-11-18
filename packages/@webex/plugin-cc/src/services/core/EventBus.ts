import {EventEmitter} from 'events';

export class EventBus extends EventEmitter {
  private static instance: EventBus;

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }

    return EventBus.instance;
  }

  public emit(event: string, detail?: any): boolean {
    return super.emit(event, detail);
  }

  public on(event: string, listener: (event: any) => void): this {
    return super.on(event, listener);
  }

  public off(event: string, listener: (event: any) => void): this {
    return super.off(event, listener);
  }
}
