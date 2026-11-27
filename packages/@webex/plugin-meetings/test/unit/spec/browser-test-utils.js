import {EventEmitter} from 'events';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';

import testUtils from '../../utils/testUtils';

describe('meeting browser event helper', () => {
  let clock;
  let scopes;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    scopes = [new EventEmitter(), new EventEmitter(), new EventEmitter()];
  });

  afterEach(() => {
    clock.restore();
  });

  const assertClean = () => {
    scopes.forEach((scope) => assert.equal(scope.eventNames().length, 0));
    assert.equal(clock.countTimers(), 0);
  };

  it('requires each participant even when another emits the same event repeatedly', async () => {
    const done = sinon.spy();
    const wait = testUtils
      .waitForEvents(scopes.map((scope) => ({scope, event: 'ready'})))
      .then(done);

    scopes[0].emit('ready', 'first');
    scopes[0].emit('ready', 'duplicate');
    scopes[0].emit('ready', 'duplicate');
    await clock.tickAsync(0);
    assert.notCalled(done);
    scopes[1].emit('ready', 'second');
    scopes[2].emit('ready', 'third');
    await wait;

    assert.calledOnce(done);
    assert.deepEqual(
      done.firstCall.args[0].map(({result}) => result),
      ['first', 'second', 'third']
    );
    assertClean();
  });

  it('ignores non-matching events and still waits for every other event', async () => {
    const done = sinon.spy();
    const wait = testUtils
      .waitForEvents([
        {scope: scopes[0], event: 'filtered', match: (value) => value === 'wanted'},
        {scope: scopes[1], event: 'other'},
      ])
      .then(done);

    scopes[0].emit('filtered', 'wrong');
    scopes[0].emit('filtered', 'wanted');
    await clock.tickAsync(0);
    assert.notCalled(done);
    scopes[1].emit('other', 'second');
    await wait;

    assert.lengthOf(done.firstCall.args[0], 2);
    assert.equal(done.firstCall.args[0].filtered.result, 'wanted');
    assertClean();
  });

  it('reports only missing descriptors and removes every listener at the deadline', async () => {
    const rejected = sinon.spy();
    const wait = testUtils
      .waitForEvents(
        scopes.map((scope) => ({scope, event: 'ready'})),
        100
      )
      .catch(rejected);

    scopes[0].emit('ready');
    await clock.tickAsync(100);
    await wait;

    assert.calledOnce(rejected);
    assert.include(rejected.firstCall.args[0].message, 'ready');
    assertClean();
  });

  it('propagates a matcher error and cleans up all listeners and the timer', async () => {
    const error = new Error('bad predicate');
    const wait = testUtils.waitForEvents([
      {
        scope: scopes[0],
        event: 'ready',
        match: () => {
          throw error;
        },
      },
      {scope: scopes[1], event: 'other'},
    ]);
    const rejected = assert.isRejected(wait, error.message);

    scopes[0].emit('ready');
    await rejected;
    assertClean();
  });

  it('preserves arrival order, event aliases, and meeting-added fixture fields', async () => {
    const user = {name: 'synthetic'};
    const meeting = {locusInfo: {parsedLocus: {selfId: 'synthetic-self'}}};
    const wait = testUtils.waitForEvents([
      {scope: scopes[0], event: 'meeting:added', user},
      {scope: scopes[1], event: 'other'},
    ]);

    scopes[1].emit('other', 'first');
    scopes[0].emit('meeting:added', {meeting});
    const result = await wait;

    assert.equal(result[0].event, 'other');
    assert.equal(result['meeting:added'].result.meeting, meeting);
    assert.strictEqual(user.meeting, meeting);
    assert.equal(user.memberId, 'synthetic-self');
    assert.equal(meeting.name, 'synthetic');
    assertClean();
  });

  it('clears the matching removed meeting', async () => {
    const user = {meeting: {id: 'synthetic'}};
    const wait = testUtils.waitForEvents([{scope: scopes[0], event: 'meeting:removed', user}]);
    scopes[0].emit('meeting:removed', {meetingId: 'synthetic'});
    await wait;
    assert.isNull(user.meeting);
    assertClean();
  });

  it('rejects a removal for another meeting without clearing the fixture', async () => {
    const meeting = {id: 'synthetic'};
    const user = {meeting};
    const wait = testUtils.waitForEvents([{scope: scopes[0], event: 'meeting:removed', user}]);
    const rejected = assert.isRejected(wait, 'Different Meeting Object');
    scopes[0].emit('meeting:removed', {meetingId: 'other'});
    await rejected;
    assert.strictEqual(user.meeting, meeting);
    assertClean();
  });
  it('resolves an empty event list immediately without a timer', async () => {
    const result = await testUtils.waitForEvents([]);
    assert.lengthOf(result, 0);
    assertClean();
  });

  it('cleans up earlier registrations when another scope is invalid', async () => {
    await assert.isRejected(
      testUtils.waitForEvents([
        {scope: scopes[0], event: 'ready'},
        {scope: {}, event: 'other'},
      ])
    );
    assertClean();
  });

  it('releases an operation deadline on success', async () => {
    assert.equal(await testUtils.withTimeout(Promise.resolve(42), 100), 42);
    assertClean();
  });

  it('propagates an operation rejection unchanged and releases its deadline', async () => {
    const error = new Error('synthetic failure');
    const rejected = sinon.spy();
    await testUtils.withTimeout(Promise.reject(error), 100).catch(rejected);
    assert.calledOnceWithExactly(rejected, error);
    assertClean();
  });

  it('reports operation state at the deadline rather than at registration', async () => {
    let phase = 'starting';
    const rejected = sinon.spy();
    const wait = testUtils.withTimeout(new Promise(() => {}), 80000, () => phase).catch(rejected);
    await clock.tickAsync(35000);
    assert.notCalled(rejected);
    phase = 'waiting for SDK';
    await clock.tickAsync(45000);
    await wait;
    assert.calledOnce(rejected);
    assert.equal(rejected.firstCall.args[0].message, 'waiting for SDK in 80000 ms');
    assertClean();
  });
});
