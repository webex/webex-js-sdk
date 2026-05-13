import {ConnectionError} from './errors';

describe('Mobius socket errors', () => {
  it('updates close-event details without redefining instance properties', () => {
    const error = new ConnectionError({code: 3050, reason: 'done (permanent)'});

    expect(error.code).toBe(3050);
    expect(error.reason).toBe('done (permanent)');
    expect(() => error.parse({code: 3051, reason: 'retry'})).not.toThrow();
    expect(error.code).toBe(3051);
    expect(error.reason).toBe('retry');
  });
});
