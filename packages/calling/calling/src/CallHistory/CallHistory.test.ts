/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable dot-notation */
import {LOGGER} from '../Logger/types';
import {getTestUtilsWebex} from '../common/testUtil';
import {SORT, SORT_BY, WebexRequestPayload} from '../common/types';
import {CallHistory, createCallHistoryClient} from './CallHistory';
import {ICallHistory} from './types';
import {sortedCallHistory, mockCallHistoryBody, MOCK_SESSION_EVENT} from './callHistoryFixtures';
import {CallSessionEvent, EVENT_KEYS, MOBIUS_EVENT_KEYS} from '../Events/types';

const webex = getTestUtilsWebex();

describe('Call history tests', () => {
  let callHistory: ICallHistory;

  beforeAll(() => {
    callHistory = new CallHistory(webex, {level: LOGGER.INFO});
  });

  it('verify successful call history case', async () => {
    const callHistoryPayload = <WebexRequestPayload>(<unknown>mockCallHistoryBody);

    webex.request.mockResolvedValue(callHistoryPayload);
    const response = await callHistory.getCallHistoryData(7, 10, SORT.DEFAULT, SORT_BY.DEFAULT);

    expect(response.statusCode).toBe(200);
    expect(response.message).toBe('SUCCESS');
  });

  it('verify bad request failed call history case', async () => {
    const failurePayload = {
      statusCode: 400,
    };
    const callHistoryPayload = <WebexRequestPayload>(<unknown>failurePayload);

    webex.request.mockRejectedValue(callHistoryPayload);
    const response = await callHistory.getCallHistoryData(7, 2000, SORT.ASC, SORT_BY.START_TIME);

    expect(response.statusCode).toBe(400);
    expect(response.message).toBe('FAILURE');
  });

  it('verify device not found call history case', async () => {
    const failurePayload = {
      statusCode: 404,
    };
    const callHistoryPayload = <WebexRequestPayload>(<unknown>failurePayload);

    webex.request.mockRejectedValue(callHistoryPayload);
    const response = await callHistory.getCallHistoryData(0, 0, SORT.ASC, SORT_BY.START_TIME);

    expect(response.statusCode).toBe(404);
    expect(response.message).toBe('FAILURE');
  });

  describe('sorting  user session response data by sortby', () => {
    it('Array should be sort.ASC by START TIME ', async () => {
      const callHistoryPayload = <WebexRequestPayload>(<unknown>mockCallHistoryBody);

      webex.request.mockResolvedValue(callHistoryPayload);
      const response = await callHistory.getCallHistoryData(10, 20, SORT.ASC, SORT_BY.START_TIME);

      const responseDetails = {
        statusCode: sortedCallHistory.body.statusCode,
        data: {
          userSessions: sortedCallHistory.body.userSessions,
        },
        message: 'SUCCESS',
      };

      expect(response).toEqual(responseDetails);
    });
  });

  describe('Call History Session Event test', () => {
    const mockOn = webex.internal.mercury.on;
    let callHistory: ICallHistory;

    beforeEach(() => {
      callHistory = createCallHistoryClient(webex, {level: LOGGER.INFO});
    });

    it('verify the recent user session event ', (done) => {
      callHistory.on(EVENT_KEYS.CALL_HISTORY_USER_SESSION_INFO, (event: CallSessionEvent) => {
        expect(event.data).toEqual(MOCK_SESSION_EVENT.data);
        done();
      });

      expect(mockOn.mock.calls[0][0]).toEqual(MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_INCLUSIVE);
      const callSessionCallback = mockOn.mock.calls[0][1];

      callSessionCallback(MOCK_SESSION_EVENT);
    });
  });
});
