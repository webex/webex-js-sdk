import Mercury from '@webex/internal-plugin-mercury';


import {LLM} from './constants';
// eslint-disable-next-line no-unused-vars
import {ILLMChannel} from './llm.types';

export const config = {
  llm: {
    /**
     * Milliseconds between pings sent up the socket
     * @type {number}
     */
    pingInterval: process.env.MERCURY_PING_INTERVAL || 15000,
    /**
     * Milliseconds to wait for a pong before declaring the connection dead
     * @type {number}
     */
    pongTimeout: process.env.MERCURY_PONG_TIMEOUT || 14000,
    /**
     * Maximum milliseconds between connection attempts
     * @type {Number}
     */
    backoffTimeMax: process.env.MERCURY_BACKOFF_TIME_MAX || 32000,
    /**
     * Initial milliseconds between connection attempts
     * @type {Number}
     */
    backoffTimeReset: process.env.MERCURY_BACKOFF_TIME_RESET || 1000,
    /**
     * Milliseconds to wait for a close frame before declaring the socket dead and
     * discarding it
     * @type {[type]}
     */
    forceCloseDelay: process.env.MERCURY_FORCE_CLOSE_DELAY || 2000,
  },
};

/**
 * LLMChannel to provide socket connections
 */
export default class LLMChannel extends (Mercury as any) implements ILLMChannel {
  namespace = LLM;

  /**
     * If the LLM plugin has been registered and listening
     * @instance
     * @type {Boolean}
     * @public
     */
  private registered:boolean = false;

  public webex: any;

  private webSocketUrl: string;

  private binding: string;

  private locusUrl: string;


  /**
   * Initializes the LLM Plugin
   * @constructor
   * @public
   */
  constructor(...args) {
    // eslint-disable-next-line constructor-super
    super(...args);


    this.registered = false;
  }

  /**
   * Register to the websocket
   * @param {string} llmSocketUrl
   * @returns {Promise<void>}
   */
  private register = (llmSocketUrl:string):Promise<void> => this.request({
    method: 'POST',
    url: llmSocketUrl,
  }).then((res: { body: { webSocketUrl: string; binding: string; }; }) => {
    this.webSocketUrl = res.body.webSocketUrl;
    this.binding = res.body.binding;
  });

  /**
   * Register and connect to the websocket
   * @param {string} locusUrl
   * @param {string} datachannelUrl
   * @returns {Promise<void>}
   */
  public registerAndConnect = (locusUrl:string, datachannelUrl:string):Promise<void> => this.register(datachannelUrl).then(() => {
    if(!locusUrl || !datachannelUrl) return undefined;
    this.locusUrl = locusUrl;
    this.connect(this.webSocketUrl).then(() => {
      this.registered = true;
    });
  });

  /**
   * Tells if LLM socket is connected
   * @returns {boolean} isRegistered
   */
  public isConnected = ():boolean => this.registered;

  /**
   * Tells if LLM socket is connected
   * @returns {bool} isRegistered
   */
  public getBinding = ():string => this.binding;

  /**
   * Get Locus URL for the connection
   * @returns {string} locus Url
   */
  public getLocusUrl = ():string => this.locusUrl;
  /**
   * Disconnects websocket connection
   * @returns Promise<void>
   */
  public disconnectLLM = () => this.disconnect()
}

