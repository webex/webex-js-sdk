export enum PresenceStatus {
  ACTIVE = 'active',
  CALENDAR_ITEM = 'calendarItem',
  CALL = 'call',
  CLEAR = 'clear',
  DND = 'dnd',
  INACTIVE = 'inactive',
  MEETING = 'meeting',
  OOO = 'ooo',
  PRESENTING = 'presenting',
}

export interface IPresenceStatusObject {
  url: string;
  subject: string;
  status: PresenceStatus;
  statusTime: string;
  lastActive: string;
  expiresTTL: number;
  vectorCounters: object;
  suppressNotifications: boolean;
}

export interface IEventPayload {
  type: string;
  payload: any;
}

export interface IPresence {
  initialize(): void;
  emitEvent(event: string, payload: IEventPayload): void;
  enable(): Promise<boolean>;
  disable(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  get(personId: string): Promise<IPresenceStatusObject>;
  list(personIds: string[]): Promise<{statusList: IPresenceStatusObject[]}>;
  subscribe(personIds: string | string[], subscriptionTtl?: number): Promise<{responses: any[]}>;
  unsubscribe(personIds: string | string[]): Promise<{responses: any}>;
  setStatus(status: string, ttl: number): Promise<any>;
  enqueue(id: string): void;
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
