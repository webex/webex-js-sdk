declare module '@webex/internal-plugin-mercury' {
  export default class Mercury {
    config: object;
    constructor(options: object);

    initialize(instance: any, options: object): void;
    request(options: {method: string; url: string; body: object}): Promise<any>;
    connect(url: string): Promise<void>;
    disconnect(): Promise<void>;
    get connected(): boolean;
    on(eventName: string, callback: (event: object) => void): void;
    off(eventName: string, callback: (event: object) => void): void;
  }
}
