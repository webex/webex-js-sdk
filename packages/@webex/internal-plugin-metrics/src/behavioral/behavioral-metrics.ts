/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

/**
 * Behavioral Metrics Pipeline
 * TODO: to be implemented
 * @class
 */
export default class BehavioralMetrics {
  // eslint-disable-next-line no-use-before-define
  meetingCollection: any;
  webex: any;

  /**
   * Constructor
   * @constructor
   * @public
   */
  constructor() {
    this.webex = null;
  }

  /**
   *
   * @param name
   * @param payload
   */
  prepareEvent(name: string, payload: any) {
    throw new Error('Not implemented');
  }

  /**
   * Initializes the CallDiagnosticMetrics singleton with a meeting Collection.
   *
   * @param meetingCollection meetings object
   * @param webex  webex SDK object
   *
   * @returns
   */
  public initialSetup(meetingCollection: any, webex: object) {
    this.meetingCollection = meetingCollection;
    this.webex = webex;
  }

  /**
   *
   */
  public submitBehavioralEvent() {
    // TODO: not implemented
    throw new Error('Not implemented');
  }
}
