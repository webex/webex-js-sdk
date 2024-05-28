export enum Operation {
  /**
   * Clear the presence status of the user.
   */
  CLEAR = 'clear',
  /**
   * Set the presence status of the user.
   */
  SET = 'set',
}

export enum Availability {
  /**
   * The user is available.
   */
  AVAILABLE = 'available',
  /**
   * The user is away.
   */
  AWAY = 'away',
  /**
   * The user is busy.
   */
  BUSY = 'busy',
  /**
   * The user is in do-not-disturb mode.
   */
  DND = 'dnd',
}

export enum WorkStatus {
  /**
   * The user is currently in a calendar event.
   */
  CALENDAR_ITEM = 'calendarItem',
  /**
   * The user is currently in a call.
   */
  CALL = 'call',
  /**
   * The user is currently in a meeting.
   */
  MEETING = 'meeting',
  /**
   * The user is currently presenting.
   */
  PRESENTING = 'presenting',
  /**
   * The user is currently out of office.
   */
  OOO = 'ooo',
}

export type PresenceRequestBody = {
  operation: Operation;
  type?: WorkStatus | Availability;
  ttlSecs?: number;
  label?: string;
};

export type PresenceResponse = {
  operation: Operation;
  type: WorkStatus;
  label: string;
  ttlSecs: number;
  expires: string;
};

// export enum PresenceStatus {
//   ACTIVE = 'active',
//   CALENDAR_ITEM = 'calendarItem',
//   CALL = 'call',
//   CLEAR = 'clear',
//   DND = 'dnd',
//   INACTIVE = 'inactive',
//   MEETING = 'meeting',
//   OOO = 'ooo',
//   PRESENTING = 'presenting',
// }

// export interface IPresenceStatusObject {
//   url: string;
//   subject: string;
//   status: PresenceStatus;
//   statusTime: string;
//   lastActive: string;
//   expiresTTL: number;
//   vectorCounters: object;
//   suppressNotifications: boolean;
// }

export interface IEventPayload {
  type: string;
  payload: any;
}

/**
 * Interface for the presence plugin. The presence plugin provides a set of methods to work with
 * compositions as well as subscriptions of the presence status of users.
 */
export interface IPresence {
  /**
   * Initialize the presence worker for client
   * @returns {undefined}
   */
  initialize(): void;
  /**
   * Emits an event to the listener.
   * @param event - name of the event emitted.
   * @param payload - payload of the event emitted.
   */
  emitEvent(event: string, payload: IEventPayload): void;
  /**
   * Enables presence feature
   * @returns {Promise<boolean>} resolves with true, if successful
   */
  enable(): Promise<boolean>;
  /**
   * Disables presence feature
   * @returns {Promise<boolean>} resolves with false, if successful
   */
  disable(): Promise<boolean>;
  /**
   * Returns true if presence is enabled, false otherwise
   * @returns {Promise<boolean>} resolves with true if presence is enabled
   */
  isEnabled(): Promise<boolean>;
  // get(personId: string): Promise<IPresenceStatusObject>;
  // list(personIds: string[]): Promise<{statusList: IPresenceStatusObject[]}>;
  /**
   * Subscribes to a person's presence status updates
   * Updates are sent via mercury events `apheleia.subscription_update`
   * @param {string | Array} personIds
   * @param {number} subscriptionTtl - Requested length of subscriptions in seconds.
   * @returns {Promise}
   */
  subscribe(personIds: string | string[], subscriptionTtl?: number): Promise<{responses: any[]}>;
  /**
   * Unsubscribes from a person or group of people's presence subscription
   * @param {string | Array} personIds
   * @returns {Promise}
   */
  unsubscribe(personIds: string | string[]): Promise<{responses: any}>;
  /**
   * Set the status for this user. Use this method if you're not interested in granular control over
   * the activity, availability and workstatus.
   * @param status - string identifying the status of the user. TODO: Maybe this is the wrong type?
   * @param ttl - duration of the status that needs to be set.
   */
  setStatus(status: string, ttl: number): Promise<any>;
  /**
   * Sets the availability of the user.
   * @param availability - is the user available, away, busy or dnd.
   */
  setAvailability(availability: Availability): Promise<void>;
  /**
   * Sets the work status of the user.
   * @param workStatus - is the user in a calendar event, call, meeting, presenting or out-of-office.
   */
  setWorkStatus(workStatus: WorkStatus): Promise<void>;
  /**
   * Signals that the user is currently active.
   */
  setActive(): Promise<void>;
  /**
   * Retrieves and subscribes to a user's presence.
   * @param {string} id
   * @returns {undefined}
   */
  enqueue(id: string): void;
  /**
   * Retract from subscribing to a user's presence.
   * @param {string} id
   * @returns {undefined}
   */
  dequeue(id: string): void;
}

export interface IWebex {
  internal: any;
  presence: IPresence;
}

export interface IGenericKeyValue {
  [id: string]: number;
}

export interface IPresenceBatcher {
  handleHttpSuccess(res: any): Promise<any>;
  handleItemFailure(item: string, response: any): Promise<any>;
  handleItemSuccess(item: string, response: any): Promise<any>;
  fingerprintRequest(id: string): Promise<string>;
  fingerprintResponse(id: string): Promise<string>;
  prepareRequest(ids: string[]): Promise<string[]>;
  submitHttpRequest(subjects: any): Promise<any>;
}

export interface IResponse {
  body: {
    eventType: string;
    subject: string;
    status?: string;
  };
}

export interface IPredicate {
  name: string;
  direction: string;
  test(ctx: any, response: IResponse): Promise<boolean>;
  extract?(response: IResponse): Promise<IResponse>;
}

export interface ITransform {
  name: string;
  direction: string;
  fn(ctx: any, response: IResponse): void;
}
