import {ConnectionError} from './errors';

describe('Mobius socket errors', () => {
  it('preserves close-event details assigned after super(event)', () => {
    const error = new ConnectionError({code: 3050, reason: 'done (permanent)'});

    expect(error.code).toBe(3050);
    expect(error.reason).toBe('done (permanent)');
    expect(error.parse({code: 3051, reason: 'retry'})).toBe('retry');
    expect(error.code).toBe(3050);
    expect(error.reason).toBe('done (permanent)');
  });
});
