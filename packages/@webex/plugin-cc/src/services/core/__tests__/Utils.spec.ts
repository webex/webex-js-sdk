import {describe, it, expect} from '@jest/globals';
// Import the function to test
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {getStationLoginErrorDetails} = require('../Utils');

describe('getStationLoginErrorDetails', () => {
  it('should return DUPLICATE_LOCATION message and fieldName', () => {
    const failure = {data: {reason: 'DUPLICATE_LOCATION'}};
    const result = getStationLoginErrorDetails(failure);
    expect(result).toEqual({
      message: 'This extension is already in use',
      fieldName: 'input',
    });
  });

  it('should return INVALID_DIAL_NUMBER message and fieldName', () => {
    const failure = {data: {reason: 'INVALID_DIAL_NUMBER'}};
    const result = getStationLoginErrorDetails(failure);
    expect(result).toEqual({
      message:
        'Enter a valid US dial number. For help, reach out to your administrator or support team.',
      fieldName: 'input',
    });
  });

  it('should return default message and fieldName for empty reason', () => {
    const failure = {data: {reason: ''}};
    const result = getStationLoginErrorDetails(failure);
    expect(result).toEqual({
      message: 'An error occurred while logging in to the station',
      fieldName: 'generic',
    });
  });

  it('should return default message and fieldName for missing reason', () => {
    const failure = {data: {}};
    const result = getStationLoginErrorDetails(failure);
    expect(result).toEqual({
      message: 'An error occurred while logging in to the station',
      fieldName: 'generic',
    });
  });

  it('should return default message and fieldName for unknown reason', () => {
    const failure = {data: {reason: 'UNKNOWN_REASON'}};
    const result = getStationLoginErrorDetails(failure);
    expect(result).toEqual({
      message: undefined,
      fieldName: undefined,
    });
  });
});
