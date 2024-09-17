import {Eventing} from '../Events/impl';
import {
  CallHistoryEventTypes,
  EndTimeSessionId,
  UserSession,
  UCMLinesApiResponse,
} from '../Events/types';
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

export type UpdateMissedCallsResponse = {
  statusCode: number;
  data: {
    readStatusMessage?: string;
    error?: string;
  };
  message: string | null;
};

export type UCMLinesResponse = {
  statusCode: number;
  data: {
    lines?: UCMLinesApiResponse;
    error?: string;
  };
  message: string | null;
};

/**
 * Interface for CallHistory Client.
 * This encompasses a set of APIs designed to facilitate the retrieval of recent Call History Record.
 */
export interface ICallHistory extends Eventing<CallHistoryEventTypes> {
  /**
   * This API `getCallHistoryData` is utilized to request and retrieve Call History Records based on specified parameters.
   * It accepts the following input parameters:
   *
   * @param days - Number of days to fetch the call history data.
   * @param limit - Number of records to be fetched.
   * @param sort - Sort the records in ascending or descending order.
   * @param sortBy - Sort the records by start time or end time.
   *
   * @example
   * ```javascript
   * const callHistoryResponse = await callHistory.getCallHistoryData(days, limit, sort, sortBy);
   * ```
   */
  getCallHistoryData(
    days: number,
    limit: number,
    sort: SORT,
    sortBy: SORT_BY
  ): Promise<JanusResponseEvent>;
  /**
   * This API `updateMissedCalls` is utilized to update the read state of user missed calls based on the specified parameters.
   * It accepts the following input parameters:
   *
   * @param endTimeSessionIds - An array of objects representing the endTime and sessionId of missed call history records.
   *
   * @example
   * ```javascript
   * const updateMissedCallHistoryResponse = await callHistory.updateMissedCalls(endTimeSessionIds);
   * ```
   */
  updateMissedCalls(endTimeSessionIds: EndTimeSessionId[]): Promise<UpdateMissedCallsResponse>;
}
