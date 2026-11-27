const {
  areAllTasksSafe,
  createRecoveryMarker,
  getLegacyExternalTransitionDecision,
  getRecoveryDecision,
  getSelectableIdleCodes,
  getUnconfirmedChannelTypes,
  getWellnessTransition,
  parseRecoveryMarker,
  shouldResetForSessionEvent,
  shouldResetSampleAfterDeregister,
} = require('../../../../../../docs/samples/contact-center/wellness-utils');
const {readFileSync} = require('fs');
const {resolve} = require('path');
const {EventEmitter} = require('events');

function loadSampleFunction(name, nextFunction, dependencies) {
  const source = readFileSync(
    resolve(__dirname, '../../../../../../docs/samples/contact-center/app.js'),
    'utf8'
  );
  const start = source.indexOf(name);
  const end = source.indexOf(nextFunction, start);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${name} in sample app`);

  return new Function(
    ...Object.keys(dependencies),
    `${source.slice(start, end)}\nreturn ${name.split('(')[0].split(' ').pop()};`
  )(...Object.values(dependencies));
}

describe('Contact Center wellness sample utilities', () => {
  describe('safe task detection', () => {
    it.each([
      ['new', false, true],
      ['reserved', false, true],
      ['connected', false, true],
      ['consulting', false, true],
      ['conference', false, true],
      ['wrapup', false, true],
      ['campaignPreview', false, true],
      ['terminated', false, false],
      ['completed', false, false],
      ['completed', true, true],
    ])(
      'classifies task state %s with wrapUpRequired=%s',
      (state, wrapUpRequired, expectedBlocking) => {
        const taskList = {
          task: {
            data: {
              wrapUpRequired,
              interaction: {state},
            },
          },
        };

        expect(areAllTasksSafe(taskList)).toBe(!expectedBlocking);
      }
    );

    it('requires every task to be terminal', () => {
      expect(
        areAllTasksSafe({
          completed: {data: {interaction: {state: 'completed'}}},
          active: {data: {interaction: {state: 'engaged'}}},
        })
      ).toBe(false);
    });

    it('treats an incomplete task shape as blocking until authoritative state arrives', () => {
      expect(areAllTasksSafe({task: {}})).toBe(false);
    });
  });

  describe('external state synchronization', () => {
    it.each([
      ['OnBreak', 'user-idle', 'complete'],
      ['OnBreak', 'rona-code', 'ignore'],
      ['WaitingForSafeState', 'rona-code', 'cancel'],
      ['Ready', '0', 'ignore'],
    ])(
      'returns %s / %s as %s',
      (lifecycle, nextAuxCodeId, expected) => {
        expect(
          getLegacyExternalTransitionDecision({
            lifecycle,
            nextAuxCodeId,
            wellnessAuxCodeId: 'wellness',
            validIdleCodeIds: ['user-idle'],
          })
        ).toBe(expected);
      }
    );
  });

  describe('ordinary status selector', () => {
    it('excludes WellbeingBreak and every other system code', () => {
      expect(
        getSelectableIdleCodes([
          {id: '0', name: 'Available', isSystem: false},
          {id: 'training', name: 'Training', isSystem: false},
          {id: 'wellness', name: 'WellbeingBreak', isSystem: true},
          {id: 'rona', name: 'RONA', isSystem: true},
        ])
      ).toEqual([
        {id: '0', name: 'Available', isSystem: false},
        {id: 'training', name: 'Training', isSystem: false},
      ]);
    });
  });

  describe('sample public surface guard', () => {
    it('attaches the wellness constants consumed by the standalone browser sample', () => {
      const webexSource = readFileSync(
        resolve(__dirname, '../../../src/webex.js'),
        'utf8'
      );
      const appSource = readFileSync(
        resolve(__dirname, '../../../../../../docs/samples/contact-center/app.js'),
        'utf8'
      );

      ['WELLNESS_BREAK_NOTIFICATION_ACTIONS', 'WELLNESS_BREAK_USER_ACTIONS'].forEach(
        (surface) => {
          expect(webexSource).toContain(`Webex.${surface} = ${surface};`);
          expect(appSource).toContain(surface);
        }
      );
    });

    it('keeps the intake v0.4 US English wellness copy in the sample surfaces', () => {
      const appSource = readFileSync(
        resolve(__dirname, '../../../../../../docs/samples/contact-center/app.js'),
        'utf8'
      );
      const htmlSource = readFileSync(
        resolve(__dirname, '../../../../../../docs/samples/contact-center/index.html'),
        'utf8'
      );
      const sampleSource = `${appSource}\n${htmlSource}`.replace(/\\'/g, "'");

      [
        'Well-being break scheduled',
        'This break is pre-approved by your organization for your well-being. You deserve it.',
        'Take wellbeing break',
        'Take a break',
        'Later',
        'Great. Your well-being break will begin shortly.',
        'Great. Your well-being break starts right after this call.',
        "It's great to see your dedication. But remember, taking breaks can boost your productivity and your health.",
        "I'm sorry, you've reached your well-being break limit today. Continue with your tasks, but remember to take care of yourself.",
        "Looks like you're busy. I didn't get a response, so I'll check back with you shortly.",
        'Relax',
        'Your 1 minute well-being break is starting in',
        'This moment is yours.',
        "In a few moments, you'll return to your day.",
        'Transitioning back to work mode in',
        'Well-being break completed',
        "I hope you're feeling recharged after that well-being break. See you in your next break!",
        "We couldn't start your well-being break due to a system issue. Please continue with your tasks and we will see you in your next well-being break.",
        'We encountered an issue setting your status to Available.',
        "We couldn't start your well-being break due to a system issue.",
      ].forEach((copy) => expect(sampleSource).toContain(copy));
    });

  });

  describe('lifecycle transitions', () => {
    it('revokes manual request eligibility after a not-allowed decision', () => {
      expect(
        getWellnessTransition(
          {lifecycle: 'RequestPending', hasOffer: false, isReady: true},
          {type: 'NOT_ALLOWED'}
        )
      ).toEqual({
        lifecycle: 'Ready',
        canRequest: false,
        clearOffer: true,
        clearManualRequest: true,
      });
    });

    it('keeps an offer retryable when response delivery fails', () => {
      expect(
        getWellnessTransition(
          {lifecycle: 'OfferPending', hasOffer: true, isReady: true},
          {type: 'OFFER_RESPONSE_STARTED'}
        )
      ).toEqual({lifecycle: 'OfferResponding', allowed: true});
      expect(
        getWellnessTransition(
          {lifecycle: 'OfferResponding', hasOffer: true, isReady: true},
          {type: 'OFFER_RESPONSE_FAILED'}
        )
      ).toEqual({lifecycle: 'OfferPending', rearmOffer: true});
    });

    it('clears an offer only after its response succeeds', () => {
      expect(
        getWellnessTransition(
          {lifecycle: 'OfferResponding', hasOffer: true, isReady: true},
          {type: 'OFFER_RESPONSE_SUCCEEDED'}
        )
      ).toEqual({lifecycle: 'Ready', clearOffer: true});
    });

    it.each([
      [undefined, 'session-1', true],
      ['session-1', 'session-1', true],
      ['session-2', 'session-1', false],
    ])(
      'scopes session cleanup for event session %s',
      (eventSessionId, activeSessionId, expected) => {
        expect(shouldResetForSessionEvent(eventSessionId, activeSessionId)).toBe(expected);
      }
    );

    it.each([
      [true, true, true],
      [false, false, true],
      [false, true, false],
    ])(
      'decides deregistration cleanup for success=%s config=%s',
      (succeeded, hasAgentConfig, expected) => {
        expect(shouldResetSampleAfterDeregister({succeeded, hasAgentConfig})).toBe(expected);
      }
    );
  });

  describe('browser recovery marker', () => {
    it('round-trips only legacy session ownership', () => {
      const marker = createRecoveryMarker({
        agentSessionId: 'session-1',
      });

      expect(parseRecoveryMarker(JSON.stringify(marker))).toEqual({
        version: 1,
        agentSessionId: 'session-1',
        stateModel: 'legacy',
      });
    });

    it.each([
      {
        name: 'discards another session',
        input: {
          marker: createRecoveryMarker({
            agentSessionId: 'session-1',
          }),
          agentSessionId: 'session-2',
        },
        expected: 'discard',
      },
      {
        name: 'waits for an authoritative legacy snapshot',
        input: {
          marker: createRecoveryMarker({
            agentSessionId: 'session-1',
          }),
          agentSessionId: 'session-1',
          legacyStateKnown: false,
        },
        expected: 'wait',
      },
      {
        name: 'restores an owned legacy wellness state',
        input: {
          marker: createRecoveryMarker({
            agentSessionId: 'session-1',
          }),
          agentSessionId: 'session-1',
          legacyStateKnown: true,
          legacyAuxCodeId: 'wellness',
          wellnessAuxCodeId: 'wellness',
        },
        expected: 'restore',
      },
      {
        name: 'clears a legacy marker when the session already left wellness',
        input: {
          marker: createRecoveryMarker({
            agentSessionId: 'session-1',
          }),
          agentSessionId: 'session-1',
          legacyStateKnown: true,
          legacyAuxCodeId: '0',
          wellnessAuxCodeId: 'wellness',
        },
        expected: 'clear',
      },
    ])('$name', ({input, expected}) => {
      expect(getRecoveryDecision(input)).toBe(expected);
    });

    it('rejects malformed or unsupported recovery markers', () => {
      expect(parseRecoveryMarker('{')).toBeUndefined();
      expect(parseRecoveryMarker(JSON.stringify({version: 2}))).toBeUndefined();
      expect(
        parseRecoveryMarker(
          JSON.stringify({version: 1, agentSessionId: 'session-1', stateModel: 'agent-state-control'})
        )
      ).toBeUndefined();
    });
  });
  describe('granular wellness state changes', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    function setup(channelStates, active = true) {
      const cc = new EventEmitter();
      cc.getChannelStates = () => channelStates;
      cc.getAgentStateControl = () => ({active});
      cc.setAgentState = jest.fn().mockResolvedValue({data: {trackingId: 'request'}});
      const setState = loadSampleFunction(
        'async function setWellnessAgentState(',
        '\nfunction captureWellnessBreakContext(',
        {
          webex: {cc},
          agentId: 'agent',
          wellnessState: {idleCode: {id: 'wellness'}},
          getSelectableChannelTypes: () => Object.keys(channelStates),
          getUnconfirmedChannelTypes,
          WELLNESS_CHANNEL_CONFIRMATION_TIMEOUT_MS: 1000,
        }
      );

      return {cc, setState};
    }

    it.each([
      [{}, ['chat']],
      [{chat: {agentState: 'Available', auxCodeId: '0'}}, ['chat']],
      [{chat: {agentState: 'Idle', auxCodeId: 'lunch'}}, ['chat']],
      [{chat: {agentState: 'Idle', auxCodeId: 'wellness'}}, []],
      [{chat: {agentState: 'Engaged', auxCodeId: 'wellness', pendingIdle: true}}, []],
      [{chat: {agentState: 'Engaged', auxCodeId: 'lunch', pendingIdle: true}}, ['chat']],
    ])('checks matching Idle or pending Idle in %j', (states, expected) => {
      expect(getUnconfirmedChannelTypes(states, ['chat'], 'Idle', 'wellness')).toEqual(expected);
    });

    it.each(['Engaged', 'EngagedOther', 'WrapUp', 'Reserved', 'RONA'])(
      'confirms Available when pending Idle is cancelled during %s',
      (agentState) => {
        expect(getUnconfirmedChannelTypes(
          {chat: {agentState, auxCodeId: 'wellness', pendingIdle: false}},
          ['chat'], 'Available', '0'
        )).toEqual([]);
        expect(getUnconfirmedChannelTypes(
          {chat: {agentState, auxCodeId: 'wellness', pendingIdle: true}},
          ['chat'], 'Available', '0'
        )).toEqual(['chat']);
      }
    );

    it('waits until every target matches the latest snapshot', async () => {
      const states = {
        telephony: {agentState: 'Idle', auxCodeId: 'wellness'},
        chat: {agentState: 'Available', auxCodeId: '0'},
      };
      const {cc, setState} = setup(states);
      const pending = setState('Idle');
      const completed = jest.fn();
      pending.then(completed);
      await Promise.resolve();

      states.telephony = {agentState: 'Available', auxCodeId: '0'};
      cc.emit('agent:stateChange', {changedChannels: ['telephony'], requestTrackingId: 'request'});
      states.chat = {agentState: 'Idle', auxCodeId: 'wellness'};
      cc.emit('agent:stateChange', {changedChannels: ['chat'], requestTrackingId: 'request'});
      await Promise.resolve();
      expect(completed).not.toHaveBeenCalled();

      states.telephony = {agentState: 'Idle', auxCodeId: 'wellness'};
      cc.emit('agent:stateChange', {changedChannels: ['telephony'], requestTrackingId: 'request'});
      await expect(pending).resolves.toEqual({data: {trackingId: 'request'}});
      expect(cc.listenerCount('agent:stateChange')).toBe(0);
      expect(cc.listenerCount('agent:stateChangeFailed')).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('accepts channel notifications received before the SDK promise resolves', async () => {
      const states = {chat: {agentState: 'Available', auxCodeId: '0'}};
      const {cc, setState} = setup(states);
      cc.setAgentState.mockImplementation(async () => {
        states.chat = {agentState: 'Idle', auxCodeId: 'wellness'};
        cc.emit('agent:stateChange', {changedChannels: ['chat'], requestTrackingId: 'request'});
        return {data: {trackingId: 'request'}};
      });

      await expect(setState('Idle')).resolves.toEqual({data: {trackingId: 'request'}});
      expect(cc.listenerCount('agent:stateChange')).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('rejects a matching channel failure and removes its listeners', async () => {
      const {cc, setState} = setup({chat: {agentState: 'Available', auxCodeId: '0'}});
      const pending = setState('Idle');
      await cc.setAgentState.mock.results[0].value;
      await Promise.resolve();
      cc.emit('agent:stateChangeFailed', {trackingId: 'other', channelType: 'chat'});
      expect(cc.listenerCount('agent:stateChange')).toBe(1);
      cc.emit('agent:stateChangeFailed', {
        trackingId: 'request', channelType: 'chat', reason: 'unavailable',
      });

      await expect(pending).rejects.toThrow('chat state change failed: unavailable');
      expect(cc.listenerCount('agent:stateChange')).toBe(0);
      expect(cc.listenerCount('agent:stateChangeFailed')).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('times out incomplete channel confirmation and removes its listeners', async () => {
      const {cc, setState} = setup({chat: {agentState: 'Available', auxCodeId: '0'}});
      const pending = setState('Idle');
      await cc.setAgentState.mock.results[0].value;
      await Promise.resolve();
      const rejected = expect(pending).rejects.toThrow('Timed out waiting for every wellness channel');
      jest.advanceTimersByTime(1000);
      await rejected;
      expect(cc.listenerCount('agent:stateChange')).toBe(0);
      expect(cc.listenerCount('agent:stateChangeFailed')).toBe(0);
    });

    it('restores only wellness channels using the ordinary channelType API', async () => {
      const states = {
        telephony: {agentState: 'Idle', auxCodeId: 'lunch'},
        chat: {agentState: 'Idle', auxCodeId: 'wellness'},
      };
      const {cc, setState} = setup(states);
      cc.setAgentState.mockImplementation(async () => {
        states.chat = {agentState: 'Available', auxCodeId: '0'};
        cc.emit('agent:stateChange', {changedChannels: ['chat'], requestTrackingId: 'request'});
        return {data: {trackingId: 'request'}};
      });
      await setState('Available');
      expect(cc.setAgentState).toHaveBeenCalledWith({
        state: 'Available', auxCodeId: '0', agentId: 'agent',
        lastStateChangeReason: 'wellness-break-complete', channelType: ['chat'],
      });
    });

    it('confirms rollback when pending Idle is cancelled during active work', async () => {
      const states = {
        telephony: {agentState: 'Engaged', auxCodeId: 'wellness', pendingIdle: true},
        chat: {agentState: 'EngagedOther', auxCodeId: '0', pendingIdle: false},
      };
      const {cc, setState} = setup(states);
      cc.setAgentState.mockImplementation(async () => {
        states.telephony.pendingIdle = false;
        cc.emit('agent:stateChange', {
          changedChannels: ['telephony', 'chat'], requestTrackingId: 'request',
        });
        return {data: {trackingId: 'request'}};
      });
      await setState('Available', {channelType: ['telephony', 'chat']});
      expect(cc.setAgentState.mock.calls[0][0].channelType).toEqual(['telephony', 'chat']);
    });

    it('waits for rollback confirmations from targets that were already Available', async () => {
      const states = {
        telephony: {agentState: 'Idle', auxCodeId: 'wellness'},
        chat: {agentState: 'Available', auxCodeId: '0'},
        email: {agentState: 'Available', auxCodeId: '0'},
      };
      const {cc, setState} = setup(states);
      cc.setAgentState.mockImplementation(async () => {
        states.telephony = {agentState: 'Available', auxCodeId: '0'};
        cc.emit('agent:stateChange', {changedChannels: ['telephony'], requestTrackingId: 'request'});
        return {data: {trackingId: 'request'}};
      });
      const pending = setState('Available', {channelType: ['telephony', 'chat', 'email']});
      const completed = jest.fn();
      pending.then(completed);
      await cc.setAgentState.mock.results[0].value;
      await Promise.resolve();
      expect(completed).not.toHaveBeenCalled();
      expect(cc.listenerCount('agent:stateChange')).toBe(1);

      states.email = {agentState: 'Idle', auxCodeId: 'wellness'};
      cc.emit('agent:stateChange', {changedChannels: ['email'], requestTrackingId: 'old-entry'});
      cc.emit('agent:stateChange', {changedChannels: ['chat'], requestTrackingId: 'request'});
      await Promise.resolve();
      expect(completed).not.toHaveBeenCalled();

      states.email = {agentState: 'Available', auxCodeId: '0'};
      cc.emit('agent:stateChange', {changedChannels: ['email'], requestTrackingId: 'request'});
      await expect(pending).resolves.toEqual({data: {trackingId: 'request'}});
      expect(cc.listenerCount('agent:stateChange')).toBe(0);
      expect(cc.listenerCount('agent:stateChangeFailed')).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('removes the early state listener when the SDK request rejects', async () => {
      const {cc, setState} = setup({chat: {agentState: 'Available', auxCodeId: '0'}});
      cc.setAgentState.mockRejectedValue(new Error('HTTP request failed'));
      await expect(setState('Idle')).rejects.toThrow('HTTP request failed');
      expect(cc.listenerCount('agent:stateChange')).toBe(0);
      expect(cc.listenerCount('agent:stateChangeFailed')).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('preserves V1 request behavior without waiting for channel state', async () => {
      const {cc, setState} = setup({}, false);
      await expect(setState('Available')).resolves.toEqual({data: {trackingId: 'request'}});
      expect(cc.setAgentState).toHaveBeenCalledWith({
        state: 'Available', auxCodeId: '0', agentId: 'agent',
        lastStateChangeReason: 'wellness-break-complete',
      });
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('granular wellness recovery', () => {
    it('passes every original entry target to failed-entry cleanup', async () => {
      const targets = ['telephony', 'chat', 'email'];
      const cleanup = jest.fn().mockResolvedValue(true);
      const enter = loadSampleFunction(
        'async function enterWellnessBreak(', '\nasync function respondToWellnessOffer(',
        {
          clearWellnessOffer: jest.fn(), cancelWellnessRestoreRetry: jest.fn(),
          wellnessState: {operationGeneration: 0, idleCode: {id: 'wellness'}},
          captureWellnessBreakContext: jest.fn(), isWellnessReady: () => true,
          WELLNESS_COPY: {acceptedNotEngaged: 'Accepted.', startFailure: 'Failed.'},
          setWellnessMessage: jest.fn(), areAllTasksSafe: () => true,
          getWellnessTaskList: jest.fn(), renderWellnessState: jest.fn(),
          getSelectableChannelTypes: () => targets,
          setWellnessAgentState: jest.fn().mockRejectedValue(new Error('Chat failed')),
          restoreWellnessState: cleanup,
          webex: {cc: {getAgentStateControl: () => ({active: true})}},
        }
      );
      await enter(false);
      expect(cleanup).toHaveBeenCalledWith({
        channelTypes: targets,
        completionMessage: 'The failed wellness transition was cleaned up.',
      });
    });

    function setupRestore(restoreCall) {
      const wellnessState = {
        operationGeneration: 1, agentSessionId: 'session', lifecycle: 'Ready',
        idleCode: {id: 'wellness'}, recoveryMarker: {agentSessionId: 'session'},
      };
      const clearOwnership = jest.fn(() => { wellnessState.recoveryMarker = undefined; });
      const waitForRetry = jest.fn().mockResolvedValue(true);
      const scheduleRecovery = jest.fn();
      const restore = loadSampleFunction(
        'async function restoreWellnessState(', '\nasync function recoverWellnessBreakIfNeeded()',
        {
          wellnessState,
          WELLNESS_RESTORE_MAX_ATTEMPTS: 3,
          WELLNESS_RESTORE_RETRY_MS: 10000,
          WELLNESS_COPY: {restoreFailure: 'Failed.'},
          clearWellnessBreakTimer: jest.fn(), clearWellnessSafeStateTimer: jest.fn(),
          setWellnessMessage: jest.fn(), renderWellnessState: jest.fn(),
          performSingleWellnessRestore: restoreCall,
          waitForWellnessRestoreRetry: waitForRetry,
          clearWellnessLifecycleOwnership: clearOwnership,
          scheduleLegacyRestoreRecovery: scheduleRecovery,
          isWellnessReady: () => true,
        }
      );

      return {restore, wellnessState, clearOwnership, waitForRetry, scheduleRecovery};
    }

    it('keeps V1 bounded retries when its channel snapshot is empty', async () => {
      const restoreCall = jest.fn().mockRejectedValue(new Error('backend failure'));
      const {restore, clearOwnership, scheduleRecovery} = setupRestore(restoreCall);
      await expect(restore()).resolves.toBe(false);
      expect(restoreCall).toHaveBeenCalledTimes(3);
      expect(clearOwnership).not.toHaveBeenCalled();
      expect(scheduleRecovery).toHaveBeenCalledWith(1);
    });

    it('retains original rollback targets and ownership after partial success', async () => {
      const states = {
        telephony: {agentState: 'Idle', auxCodeId: 'wellness'},
        chat: {agentState: 'Idle', auxCodeId: 'wellness'},
      };
      const restoreCall = jest.fn()
        .mockImplementationOnce(async () => {
          states.telephony = {agentState: 'Available', auxCodeId: '0'};
          throw new Error('Chat restoration failed');
        })
        .mockImplementationOnce(async () => { states.chat = {agentState: 'Available', auxCodeId: '0'}; });
      const {restore, clearOwnership, waitForRetry} = setupRestore(restoreCall);
      await expect(restore({channelTypes: ['telephony', 'chat']}))
        .resolves.toBe(true);
      expect(restoreCall.mock.calls).toEqual([[['telephony', 'chat']], [['telephony', 'chat']]]);
      expect(waitForRetry).toHaveBeenCalledWith(10000, 1);
      expect(clearOwnership).toHaveBeenCalledTimes(1);
    });

    it('rechecks the latest mixed-channel snapshot after the wellness code loads', async () => {
      const wellnessState = {
        enabled: true, agentSessionId: 'session', lifecycle: 'Ready',
        legacyStateKnown: false, recoveryMarker: {agentSessionId: 'session'},
      };
      const recover = jest.fn();
      const states = {
        telephony: {agentState: 'Idle', auxCodeId: 'lunch'},
        chat: {agentState: 'Idle', auxCodeId: 'wellness'},
      };
      const initialize = loadSampleFunction(
        'async function initializeWellnessProfile(', '\nfunction startWellnessOfferTimer(',
        {
          wellnessState, WELLNESS_OWNED_LIFECYCLES: new Set(),
          setWellnessMessage: jest.fn(), renderWellnessState: jest.fn(),
          getSelectableIdleCodes, wellnessCodeStatusElm: {},
          GRANULAR_CHANNEL_ORDER: ['telephony', 'chat', 'email', 'social'],
          recoverWellnessBreakIfNeeded: recover,
          webex: {cc: {
            getWellbeingBreakIdleCode: jest.fn()
              .mockRejectedValueOnce(new Error('lookup failed'))
              .mockResolvedValueOnce({id: 'wellness'}),
            getChannelStates: () => states,
          }},
        }
      );
      const profile = {isWellnessBreakEnabled: true, idleCodes: []};
      await initialize(profile);
      expect(wellnessState.legacyStateKnown).toBe(false);
      await initialize(profile);
      expect(wellnessState.legacyStateKnown).toBe(true);
      expect(wellnessState.legacyAuxCodeId).toBe('wellness');
      expect(wellnessState.recoveryMarker).toEqual({agentSessionId: 'session'});
      expect(recover).toHaveBeenCalledTimes(2);
    });
  });

});
