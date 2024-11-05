import routingAgent from './agent';
import {AqmReqs} from './core/aqm-reqs';

export class Services {
  // private readonly notifs: AqmNotifs;

  public readonly agent: ReturnType<typeof routingAgent>;
  // readonly configs: ReturnType<typeof aqmConfigs>;

  constructor() {
    // this.notifs = new AqmNotifs();
    const aqmReq = new AqmReqs();
    this.agent = routingAgent(aqmReq);

    // this.configs = aqmConfigs(httpRequest);
  }
}

export const services = new Services();
