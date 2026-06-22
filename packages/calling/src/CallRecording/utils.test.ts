import {RecordingParty, RecordingServiceData} from './types';
import {getRemoteParty, getRemotePartyId} from './utils';

describe('CallRecording utils', () => {
  const callingParty: RecordingParty = {
    actor: {type: 'USER', id: 'calling-id', email: 'caller@cisco.com'},
    number: '9902',
    name: 'Caller',
  };
  const calledParty: RecordingParty = {
    actor: {type: 'USER', id: 'called-id', email: 'callee@cisco.com'},
    number: '9903',
    name: 'Callee',
  };

  describe('getRemoteParty', () => {
    /**
     * TestCase inputs
     * name: TestCase name
     * serviceData: the recording serviceData under test
     * expected: the party expected to be resolved as the remote side
     */
    const testData: {
      name: string;
      serviceData?: RecordingServiceData;
      expected: RecordingParty | undefined;
    }[] = [
      {
        name: 'returns the calledParty when the owner is the originator',
        serviceData: {personality: 'originator', callingParty, calledParty},
        expected: calledParty,
      },
      {
        name: 'returns the callingParty when the owner is the terminator',
        serviceData: {personality: 'terminator', callingParty, calledParty},
        expected: callingParty,
      },
      {
        name: 'returns undefined when personality is missing (e.g. list serviceData)',
        serviceData: {locationId: 'loc-1', callSessionId: 'session-1'},
        expected: undefined,
      },
      {
        name: 'returns undefined when serviceData is undefined',
        serviceData: undefined,
        expected: undefined,
      },
    ];

    it.each(testData)('$name', ({serviceData, expected}) => {
      expect(getRemoteParty(serviceData)).toStrictEqual(expected);
    });
  });

  describe('getRemotePartyId', () => {
    /**
     * TestCase inputs
     * name: TestCase name
     * serviceData: the recording serviceData under test
     * expected: the remote party person UUID expected to be resolved
     */
    const testData: {
      name: string;
      serviceData?: RecordingServiceData;
      expected: string | undefined;
    }[] = [
      {
        name: 'returns the calledParty actor id when the owner is the originator',
        serviceData: {personality: 'originator', callingParty, calledParty},
        expected: 'called-id',
      },
      {
        name: 'returns the callingParty actor id when the owner is the terminator',
        serviceData: {personality: 'terminator', callingParty, calledParty},
        expected: 'calling-id',
      },
      {
        name: 'returns undefined for an external party with no actor id',
        serviceData: {
          personality: 'originator',
          callingParty,
          calledParty: {number: '+15551234567'},
        },
        expected: undefined,
      },
      {
        name: 'returns undefined when personality is missing',
        serviceData: {callingParty, calledParty},
        expected: undefined,
      },
      {
        name: 'returns undefined when serviceData is undefined',
        serviceData: undefined,
        expected: undefined,
      },
    ];

    it.each(testData)('$name', ({serviceData, expected}) => {
      expect(getRemotePartyId(serviceData)).toStrictEqual(expected);
    });
  });
});
