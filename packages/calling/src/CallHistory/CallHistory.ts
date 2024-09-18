/* eslint-disable dot-notation */
/* eslint-disable no-underscore-dangle */
import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {
  ALLOWED_SERVICES,
  HTTP_METHODS,
  WebexRequestPayload,
  SORT,
  SORT_BY,
  CALLING_BACKEND,
} from '../common/types';
import {
  ICallHistory,
  JanusResponseEvent,
  LoggerInterface,
  UpdateMissedCallsResponse,
  UCMLinesResponse,
} from './types';
import log from '../Logger';
import {serviceErrorCodeHandler, getVgActionEndpoint, getCallingBackEnd} from '../common/Utils';
import {
  APPLICATION_JSON,
  CALL_HISTORY_FILE,
  CONTENT_TYPE,
  FROM_DATE,
  HISTORY,
  LIMIT,
  NUMBER_OF_DAYS,
  UPDATE_MISSED_CALLS_ENDPOINT,
  SET_READ_STATE_SUCCESS_MESSAGE,
  VERSION_1,
  UNIFIED_COMMUNICATIONS,
  CONFIG,
  PEOPLE,
  LINES,
  ORG_ID,
} from './constants';
import {STATUS_CODE, SUCCESS_MESSAGE, USER_SESSIONS} from '../common/constants';
import {
  COMMON_EVENT_KEYS,
  CallHistoryEventTypes,
  CallSessionEvent,
  MOBIUS_EVENT_KEYS,
  UserSession,
  EndTimeSessionId,
  CallSessionViewedEvent,
  SanitizedEndTimeAndSessionId,
  UCMLinesApiResponse,
} from '../Events/types';
import {Eventing} from '../Events/impl';
/**
 * `CallHistory` module is designed to facilitate the retrieval of Call History Records by providing a set of APIs.
 *
 * This code snippet demonstrates how to create an instance of `CallHistory` using webex and logger.
 *
 * @example
 * ```javascript
 * const callHistory = createCallHistoryClient(webex, logger);
 * ```
 */
export class CallHistory extends Eventing<CallHistoryEventTypes> implements ICallHistory {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private janusUrl = '';

  private fromDate = '';

  private loggerContext = {
    file: CALL_HISTORY_FILE,
    method: 'getCallHistoryData',
  };

  private userSessions: UserSession[] | undefined;

  /**
   * @ignore
   */
  constructor(webex: WebexSDK, logger: LoggerInterface) {
    super();
    this.sdkConnector = SDKConnector;
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = this.sdkConnector.getWebex();
    this.janusUrl = this.webex.internal.services._serviceUrls.janus;
    this.registerSessionsListener();
    log.setLogger(logger.level, CALL_HISTORY_FILE);
  }

  /**
   * Function to display the Janus API response.
   * @param days - Number of days to fetch the call history data.
   * @param limit - Number of records to be fetched.
   * @param sort - Sort the records in ascending or descending order.
   * @param sortBy - Sort the records by start time or end time.
   */
  public async getCallHistoryData(
    days: number = NUMBER_OF_DAYS,
    limit: number = LIMIT,
    sort: SORT = SORT.DEFAULT,
    sortBy: SORT_BY = SORT_BY.DEFAULT
  ): Promise<JanusResponseEvent> {
    /*
      1. Mandatory field for Janus API - fromDate
      2. Calculating the fromDate by deducting the NUMBER_OF_DAYS with the current date
     */
    const date = new Date();

    date.setDate(date.getDate() - days);
    this.fromDate = date.toISOString();
    const sortByParam = Object.values(SORT_BY).includes(sortBy) ? sortBy : SORT_BY.DEFAULT;
    const sortParam = Object.values(SORT).includes(sort) ? sort : SORT.DEFAULT;

    log.log(`Janus API URL ${this.janusUrl}`, this.loggerContext);
    log.info(`Call history from date : ${this.fromDate}`, this.loggerContext);
    log.info(`Call history sort type : ${sortParam}`, this.loggerContext);
    log.info(`Call history sortby type : ${sortByParam}`, this.loggerContext);
    const url = `${this.janusUrl}/${HISTORY}/${USER_SESSIONS}${FROM_DATE}=${this.fromDate}&limit=${limit}&includeNewSessionTypes=true&sort=${sortParam}`;

    try {
      const janusResponse = <WebexRequestPayload>await this.webex.request({
        uri: `${url}`,
        method: HTTP_METHODS.GET,
        service: ALLOWED_SERVICES.JANUS,
      });

      this.userSessions = janusResponse.body as UserSession[];
      if (sortByParam === SORT_BY.START_TIME) {
        if (sortParam === SORT.DESC) {
          this.userSessions[USER_SESSIONS].sort(
            (element: Date, compareElement: Date) =>
              new Date(compareElement[sortByParam]).getTime() -
              new Date(element[sortByParam]).getTime()
          );
        } else if (sortParam === SORT.ASC) {
          this.userSessions[USER_SESSIONS].sort(
            (element: Date, compareElement: Date) =>
              new Date(element[sortByParam]).getTime() -
              new Date(compareElement[sortByParam]).getTime()
          );
        }
      }
      // Check the calling backend
      const callingBackend = getCallingBackEnd(this.webex);
      if (callingBackend === CALLING_BACKEND.UCM) {
        // Check if userSessions exist and the length is greater than 0
        if (this.userSessions[USER_SESSIONS] && this.userSessions[USER_SESSIONS].length > 0) {
          // Check if cucmDN exists and is valid in any of the userSessions
          const hasCucmDN = this.userSessions[USER_SESSIONS].some(
            (session: UserSession) => session.self.cucmDN && session.self.cucmDN.length > 0
          );
          // If any user session has cucmDN, proceed to fetch line data
          if (hasCucmDN) {
            // Fetch the Lines data
            const ucmLinesResponse = await this.fetchUCMLinesData();

            // Check if the Lines API response was successful
            if (ucmLinesResponse.statusCode === 200 && ucmLinesResponse.data.lines?.devices) {
              const ucmLinesData = ucmLinesResponse.data.lines.devices;

              // Iterate over user sessions and match with Lines data
              this.userSessions[USER_SESSIONS].forEach((session: UserSession) => {
                const cucmDN = session.self.cucmDN;

                if (cucmDN) {
                  ucmLinesData.forEach((device) => {
                    device.lines.forEach((line) => {
                      if (line.dnorpattern === cucmDN) {
                        session.self.ucmLineNumber = line.index; // Assign the ucmLineNumber
                      }
                    });
                  });
                }
              });
            }
          }
        }
      }

      const responseDetails = {
        statusCode: this.userSessions[STATUS_CODE],
        data: {
          userSessions: this.userSessions[USER_SESSIONS],
        },
        message: SUCCESS_MESSAGE,
      };

      return responseDetails;
    } catch (err: unknown) {
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, this.loggerContext);

      return errorStatus;
    }
  }

  /**
   * Function to update the missed call status in the call history using sessionId and time.
   * @param endTimeSessionIds - An array of objects containing endTime and sessionId of the missed call history records
   * @returns {Promise} Resolves to an object of type  {@link UpdateMissedCallsResponse}.Response details with success or error status.
   */
  public async updateMissedCalls(
    endTimeSessionIds: EndTimeSessionId[]
  ): Promise<UpdateMissedCallsResponse> {
    const loggerContext = {
      file: CALL_HISTORY_FILE,
      method: 'updateMissedCalls',
    };
    // Convert endTime to milliseconds for each session
    const santizedSessionIds: SanitizedEndTimeAndSessionId[] = endTimeSessionIds.map((session) => ({
      ...session,
      endTime: new Date(session.endTime).getTime(),
    }));
    const requestBody = {
      endTimeSessionIds: santizedSessionIds,
    };
    try {
      const updateMissedCallContentUrl = `${this.janusUrl}/${HISTORY}/${USER_SESSIONS}/${UPDATE_MISSED_CALLS_ENDPOINT}`;
      // Make a POST request to update missed calls
      const response = await fetch(updateMissedCallContentUrl, {
        method: HTTP_METHODS.POST,
        headers: {
          [CONTENT_TYPE]: APPLICATION_JSON,
          Authorization: await this.webex.credentials.getUserToken(),
        },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        throw new Error(`${response.status}`);
      }

      const data: UpdateMissedCallsResponse = await response.json();
      log.info(`Missed calls are succesfully read by the user`, loggerContext);
      const responseDetails: UpdateMissedCallsResponse = {
        statusCode: data.statusCode as number,
        data: {
          readStatusMessage: SET_READ_STATE_SUCCESS_MESSAGE,
        },
        message: SUCCESS_MESSAGE,
      };

      return responseDetails;
    } catch (err: unknown) {
      // Catch the 401 error from try block, return the error object to user
      const errorInfo = {
        statusCode: err instanceof Error ? Number(err.message) : '',
      } as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }

  /**
   * Function to display the UCM Lines API response.
   * @returns {Promise} Resolves to an object of type  {@link UCMLinesResponse}.Response details with success or error status.
   */
  private async fetchUCMLinesData(): Promise<UCMLinesResponse> {
    const loggerContext = {
      file: CALL_HISTORY_FILE,
      method: 'fetchLinesData',
    };
    const vgEndpoint = getVgActionEndpoint(this.webex, CALLING_BACKEND.UCM);
    const userId = this.webex.internal.device.userId;
    const orgId = this.webex.internal.device.orgId;
    const linesURIForUCM = `${vgEndpoint}/${VERSION_1}/${UNIFIED_COMMUNICATIONS}/${CONFIG}/${PEOPLE}/${userId}/${LINES}?${ORG_ID}=${orgId}`;

    try {
      const response = <WebexRequestPayload>await this.webex.request({
        uri: `${linesURIForUCM}`,
        method: HTTP_METHODS.GET,
      });

      const ucmLineDetails: UCMLinesResponse = {
        statusCode: Number(response.statusCode),
        data: {
          lines: response.body as UCMLinesApiResponse,
        },
        message: SUCCESS_MESSAGE,
      };

      log.info(`Line details fetched successfully`, loggerContext);

      return ucmLineDetails;
    } catch (err: unknown) {
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }

  handleSessionEvents = async (event?: CallSessionEvent) => {
    if (event && event.data.userSessions.userSessions) {
      this.emit(COMMON_EVENT_KEYS.CALL_HISTORY_USER_SESSION_INFO, event as CallSessionEvent);
    }
  };

  handleUserReadSessionEvents = async (event?: CallSessionViewedEvent) => {
    if (event && event.data.userReadSessions.userReadSessions) {
      this.emit(
        COMMON_EVENT_KEYS.CALL_HISTORY_USER_VIEWED_SESSIONS,
        event as CallSessionViewedEvent
      );
    }
  };

  /**
   *
   */
  private registerSessionsListener() {
    this.sdkConnector.registerListener<CallSessionEvent>(
      MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_INCLUSIVE,
      this.handleSessionEvents
    );
    this.sdkConnector.registerListener<CallSessionEvent>(
      MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_LEGACY,
      this.handleSessionEvents
    );
    this.sdkConnector.registerListener<CallSessionViewedEvent>(
      MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_VIEWED,
      this.handleUserReadSessionEvents
    );
  }
}
/**
 * Creates a `CallHistory` client instance for accessing Call History APIs.
 *
 * @param {WebexSDK} webex - `Webex SDK` instance.
 * @param {LoggerInterface} logger - An instance implementing LoggerInterface used to set the log level for the module.
 */
export const createCallHistoryClient = (webex: WebexSDK, logger: LoggerInterface): ICallHistory =>
  new CallHistory(webex, logger);
