import routingAgent from './agent';
import {AqmReqs} from './core/aqm-reqs';

export default class Services {
  public readonly agent: ReturnType<typeof routingAgent>;
  private static instance: Services;

  constructor() {
    const aqmReq = new AqmReqs();
    this.agent = routingAgent(aqmReq);
  }

  public static getInstance(): Services {
    if (!this.instance) {
      this.instance = new Services();
    }

    return this.instance;
  }
}
