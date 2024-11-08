import routingAgent from './agent';
import {AqmReqs} from './core/aqm-reqs';
import {WebSocketManager} from './core/WebSocket/WebSocketManager';

export class Services {
  // private readonly notifs: AqmNotifs;

  public readonly agent: ReturnType<typeof routingAgent>;
  // readonly configs: ReturnType<typeof aqmConfigs>;
  private static instance: Services;

  constructor(webSocketManager: WebSocketManager) {
    // this.notifs = new AqmNotifs();
    const aqmReq = new AqmReqs(webSocketManager);
    this.agent = routingAgent(aqmReq);

    // this.configs = aqmConfigs(httpRequest);
  }

  public static getInstance(webSocketManager: WebSocketManager): Services {
    if (!this.instance) {
      this.instance = new Services(webSocketManager);
    }

    return this.instance;
  }
}
export default Services;
