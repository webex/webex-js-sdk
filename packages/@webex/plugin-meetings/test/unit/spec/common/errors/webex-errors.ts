import {assert} from '@webex/test-helper-chai';
import {
  AddMediaFailed,
  MediaConnectionTimedOutError,
} from '@webex/plugin-meetings/src/common/errors/webex-errors';

describe('MediaConnectionTimedOutError', () => {
  [
    {iceConnected: true, message: 'timeout with ice connected'},
    {iceConnected: false, message: 'timeout without ice connected'},
  ].forEach(({iceConnected, message}) => {
    it(`stores message and iceConnected=${iceConnected}`, () => {
      const error = new MediaConnectionTimedOutError(message, iceConnected);

      assert.equal(error.message, message);
      assert.equal(error.iceConnected, iceConnected);
      assert.equal(error.name, 'MediaConnectionTimedOutError');
      assert.instanceOf(error, Error);
    });
  });

  it('stores the cause when provided', () => {
    const cause = {iceConnected: true};
    const error = new MediaConnectionTimedOutError('timeout', true, cause);

    assert.equal(error.cause, cause);
  });

  it('leaves cause undefined when not provided', () => {
    const error = new MediaConnectionTimedOutError('timeout', true);

    assert.isUndefined(error.cause);
  });
});

describe('AddMediaFailed', () => {
  it('stores all options properties', () => {
    const cause = new Error('underlying');
    const error = new AddMediaFailed({
      cause,
      connectionType: 'UDP',
      selectedCandidatePairChanges: 3,
      numTransports: 2,
      iceConnected: true,
    });

    assert.equal(error.cause, cause);
    assert.equal(error.connectionType, 'UDP');
    assert.equal(error.selectedCandidatePairChanges, 3);
    assert.equal(error.numTransports, 2);
    assert.equal(error.iceConnected, true);
    assert.equal(error.message, 'Failed to add media');
  });

  it('works with default empty options', () => {
    const error = new AddMediaFailed();

    assert.isUndefined(error.cause);
    assert.isUndefined(error.connectionType);
    assert.isUndefined(error.selectedCandidatePairChanges);
    assert.isUndefined(error.numTransports);
    assert.isUndefined(error.iceConnected);
  });

  describe('isDtlsHandshakeFailure', () => {
    [
      {iceConnected: true, expected: true},
      {iceConnected: false, expected: false},
      {iceConnected: undefined, expected: false},
    ].forEach(({iceConnected, expected}) => {
      it(`returns ${expected} when iceConnected=${iceConnected}`, () => {
        const error = new AddMediaFailed({iceConnected});

        assert.equal(error.isDtlsHandshakeFailure, expected);
      });
    });
  });
});
