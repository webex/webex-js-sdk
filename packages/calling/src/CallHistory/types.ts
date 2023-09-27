import {Eventing} from '../Events/impl';
import {CallHistoryEventTypes, UserSession} from '../Events/types';
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
  message: string | null;
};

/**
 * Interface for CallHistory Client
 * This contains the APIs that helps to fetch the recent Call History Records.
 */
export interface ICallHistory extends Eventing<CallHistoryEventTypes> {
  /**
   * This API is used to fetch the the recent Call History Records.
   *
   * Example
   * ```javascript
   * const callHistoryResponse = await callHistory.getCallHistoryData(days, limit, sort, sortBy);
   * ```
   *
   * @param days - Number of days to fetch the call history data.
   * @param limit - Number of records to be fetched.
   * @param sort - Sort the records in ascending or descending order.
   * @param sortBy - Sort the records by start time or end time.
   */
  getCallHistoryData(
    days: number,
    limit: number,
    sort: SORT,
    sortBy: SORT_BY
  ): Promise<JanusResponseEvent>;
}
