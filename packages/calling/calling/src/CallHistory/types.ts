import {Eventing} from '../Events/impl';
import {CallHistoryEventTypes, UserSession} from '../Events/types';
import {ISDKConnector} from '../SDKConnector/types';
import {LOGGER} from '../Logger/types';
import {SORT, SORT_BY} from '../common/types';

export interface LoggerInterface {
  level: LOGGER;
}

export type JanusResponseEvent = {
  statusCode: number;
  data: {
    userSessions?: UserSession[];
    error?: string;
  };
  message: string;
};

export interface ICallHistory extends Eventing<CallHistoryEventTypes> {
  getSDKConnector: () => ISDKConnector;
  getCallHistoryData: (
    days: number,
    limit: number,
    sort: SORT,
    sortBy: SORT_BY
  ) => Promise<JanusResponseEvent>;
}
