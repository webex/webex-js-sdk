import AutoWrapup from '../../../../../src/services/task/AutoWrapup';

describe('AutoWrapup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts, reports running, and completes', () => {
    const onComplete = jest.fn();
    const timer = new AutoWrapup(1000, true);

    expect(timer.allowCancelAutoWrapup).toBe(true);
    expect(timer.isRunning()).toBe(false);

    timer.start(onComplete);
    expect(timer.isRunning()).toBe(true);
    expect(timer.getTimeLeft()).toBeGreaterThan(0);
    expect(timer.getTimeLeftSeconds()).toBeGreaterThan(0);

    jest.advanceTimersByTime(1000);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(timer.isRunning()).toBe(false);
  });

  it('clear() is safe when not running and cancels an active timer', () => {
    const onComplete = jest.fn();
    const timer = new AutoWrapup(1000);

    timer.clear(); // no-op
    expect(timer.isRunning()).toBe(false);

    timer.start(onComplete);
    expect(timer.isRunning()).toBe(true);

    timer.clear();
    expect(timer.isRunning()).toBe(false);

    jest.advanceTimersByTime(1000);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('start() replaces an existing timer', () => {
    const onComplete1 = jest.fn();
    const onComplete2 = jest.fn();
    const timer = new AutoWrapup(1000);

    timer.start(onComplete1);
    jest.advanceTimersByTime(500);

    timer.start(onComplete2);
    jest.advanceTimersByTime(500);
    expect(onComplete1).not.toHaveBeenCalled();
    expect(onComplete2).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(onComplete2).toHaveBeenCalledTimes(1);
  });
});

