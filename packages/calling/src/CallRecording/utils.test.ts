import {RecordingParty, RecordingServiceData} from './types';
import {getRemoteParty} from './utils';

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
      {
        name: 'has no actor id for an external party',
        serviceData: {
          personality: 'originator',
          callingParty,
          calledParty: {number: '+15551234567'},
        },
        expected: {number: '+15551234567'},
      },
    ];

    it.each(testData)('$name', ({serviceData, expected}) => {
      expect(getRemoteParty(serviceData)).toStrictEqual(expected);
    });

    it('returns the remote party person UUID via actor.id', () => {
      expect(
        getRemoteParty({personality: 'originator', callingParty, calledParty})?.actor?.id
      ).toBe('called-id');
      expect(
        getRemoteParty({personality: 'terminator', callingParty, calledParty})?.actor?.id
      ).toBe('calling-id');
      expect(
        getRemoteParty({
          personality: 'originator',
          callingParty,
          calledParty: {number: '+15551234567'},
        })?.actor?.id
      ).toBeUndefined();
    });
  });
});
