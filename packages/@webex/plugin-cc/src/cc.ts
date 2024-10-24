import {WebexPlugin} from '@webex/webex-core';
import AgentConfig from './AgentConfig/AgentConfig';
import {IAgentConfig} from './AgentConfig/types';
import {
  CCPluginConfig,
  IContactCenter,
  WebexSDK,
  CC_EVENTS,
  WebSocketEvent,
  SubscribeRequest,
  EventResult,
} from './types';
import {
  EVENT,
  READY,
  WEBSOCKET_EVENT_TIMEOUT,
  SUBSCRIBE_API,
  WCC_API_GATEWAY,
  CC_FILE,
} from './constants';
import IWebSocket from './WebSocket/types';
import WebSocket from './WebSocket/WebSocket';

const REGISTER_EVENT = 'register';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'cc';
  $config: CCPluginConfig;
  $webex: WebexSDK;
  wccApiUrl: string;
  agentConfig: IAgentConfig;
  webSocket: IWebSocket;
  ciUserId: string;
  registered = false;
  eventHandlers: Map<
    string,
    {resolve: (data: any) => void; reject: (error: any) => void; timeoutId: NodeJS.Timeout}
  > = new Map();

  constructor(...args) {
    super(...args);

    // @ts-ignore
    this.$webex = this.webex;

    this.$webex.once(READY, () => {
      // @ts-ignore
      this.$config = this.config;
      this.webSocket = new WebSocket({
        parent: this.$webex,
      });
    });
  }

  /**
   * This is used for making the CC SDK ready by setting up the cc mercury connection.
   */
  public async register(): Promise<string> {
    this.wccApiUrl = this.$webex.internal.services.get(WCC_API_GATEWAY);
    this.listenForWebSocketEvents();

    return new Promise((resolve, reject) => {
      this.addEventHandler(
        REGISTER_EVENT,
        (result) => {
          this.registered = true;
          resolve(result);
        },
        reject
      );

      this.establishConnection(reject);
    });
  }

  /**
   * This is used for unregistering the CC SDK by disconnecting the cc mercury connection.
   * @returns Promise<void>
   */
  public unregister(): Promise<void> {
    return this.webSocket.disconnectWebSocket().then(() => {
      this.webSocket.off(EVENT, this.processEvent);
      this.registered = false;
    });
  }

  private listenForWebSocketEvents() {
    this.webSocket.on(EVENT, this.processEvent);
  }

  private processEvent = async (event: WebSocketEvent): Promise<void> => {
    switch (event.type) {
      case CC_EVENTS.WELCOME: {
        const agentId = event.data.agentId;
        const agentConfig = new AgentConfig(agentId, this.$webex, this.wccApiUrl);
        this.agentConfig = await agentConfig.getAgentProfile();
        this.$webex.logger.log(
          `agent config is: ${JSON.stringify(this.agentConfig)} file: ${CC_FILE} method: ${
            this.register.name
          }`
        );
        this.handleEvent(REGISTER_EVENT, `Success: Agent Profile is ${this.agentConfig}`);
        break;
      }
      default:
        this.$webex.logger.info(`Unknown event: ${event.type}`);
    }
  };

  private async establishConnection(reject: (error: Error) => void) {
    const datachannelUrl = `${this.wccApiUrl}${SUBSCRIBE_API}`;

    const connectionConfig: SubscribeRequest = {
      force: this.$config?.force ?? true,
      isKeepAliveEnabled: this.$config?.isKeepAliveEnabled ?? false,
      clientType: this.$config?.clientType ?? 'WebexCCSDK',
      allowMultiLogin: this.$config?.allowMultiLogin ?? true,
    };

    try {
      await this.webSocket.subscribeAndConnect({
        datachannelUrl,
        body: connectionConfig,
      });
      this.$webex.logger.info('Successfully connected and subscribed.');
    } catch (error) {
      this.$webex.logger.info(`Error connecting and subscribing: ${error}`);
      reject(error);
    }
  }

  private handleEvent(eventName: string, result: EventResult) {
    const handler = this.eventHandlers.get(eventName);
    if (handler) {
      clearTimeout(handler.timeoutId);
      handler.resolve(result);
      this.eventHandlers.delete(eventName);
    }
  }

  private addEventHandler(
    eventName: string,
    resolve: (data: EventResult) => void,
    reject: (error: Error) => void
  ) {
    this.eventHandlers.set(eventName, {
      resolve,
      reject,
      timeoutId: setTimeout(() => {
        reject(new Error(`Time out waiting for event: ${eventName}`));
        this.eventHandlers.delete(eventName);
      }, WEBSOCKET_EVENT_TIMEOUT),
    });
  }
}
