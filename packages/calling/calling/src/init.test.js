import Webex from 'webex';
import {getTestUtilsWebex} from './common/testUtil';
import {initializeWebex} from './init';

describe('webex initialization', () => {
  const mockToken = 'Bearer 1234';
  const mockWebex = getTestUtilsWebex();

  it('initialize webex based on access token provided', () => {
    jest.spyOn(Webex,'init').mockReturnValue(mockWebex);
    const testWebex = initializeWebex(mockToken);
    expect(testWebex).toEqual(mockWebex);
  });
});
