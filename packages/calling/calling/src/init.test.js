import Webex from 'webex';
import {getTestUtilsWebex} from './common/testUtil';
import {initializeWebex} from './init';

describe('webex initialization', () => {
  const mockToken = 'Bearer 1234';
  const mockWebex = getTestUtilsWebex();
  const webexConfig = {
    config: {
      logger: {
        level: 'info',
      },
    },
    credentials: {
      access_token: mockToken,
    },
  }

  it('initialize webex based on access token provided', () => {
    jest.spyOn(Webex, 'init').mockReturnValue(mockWebex);
    const testWebex = initializeWebex(webexConfig);

    expect(testWebex).toEqual(mockWebex);
  });
});
