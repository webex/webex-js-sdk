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

function loadSampleRestoreWellnessState(dependencies) {
  return loadSampleFunction(
    'async function restoreWellnessState(options = {}) {',
    '\nasync function recoverWellnessBreakIfNeeded()',
    dependencies
  );
}

function loadSampleFunction(startMarker, endMarker, dependencies) {
  const appSource = readFileSync(
    resolve(__dirname, '../../../../../../docs/samples/contact-center/app.js'),
    'utf8'
  );
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${startMarker} in sample app`);
  const dependencyNames = Object.keys(dependencies);
  const functionFactory = new Function(
    ...dependencyNames,
    `${appSource.slice(start, end)}\nreturn ${startMarker.split('(')[0].split(' ').pop()};`
  );

  return functionFactory(...Object.values(dependencies));
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
    ])('returns %s / %s as %s', (lifecycle, nextAuxCodeId, expected) => {
      expect(
        getLegacyExternalTransitionDecision({
          lifecycle,
          nextAuxCodeId,
          wellnessAuxCodeId: 'wellness',
          validIdleCodeIds: ['user-idle'],
        })
      ).toBe(expected);
    });

    it('returns complete for OnBreak with aggregate Available (auxCodeId 0)', () => {
      // This is the scalar decision that the sample's handleWellnessLegacyStateChanged
      // must guard against when V2 channelStates show some channels still on break.
      // The utility itself correctly returns 'complete' — the caller must check
      // per-channel states before invoking.
      expect(
        getLegacyExternalTransitionDecision({
          lifecycle: 'OnBreak',
          nextAuxCodeId: '0',
          wellnessAuxCodeId: 'wellness',
          validIdleCodeIds: ['user-idle'],
        })
      ).toBe('complete');
    });
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

  describe('granular wellness channel confirmation', () => {
    it.each([
      [
        'leaves every channel unconfirmed when no states are available',
        {},
        ['telephony', 'chat'],
        ['telephony', 'chat'],
      ],
      [
        'keeps an Available channel unconfirmed when entering Idle',
        {telephony: {agentState: 'Idle', auxCodeId: 'wellness'}, chat: {agentState: 'Available'}},
        ['telephony', 'chat'],
        ['chat'],
      ],
      [
        'requires the requested idle code on every channel',
        {
          telephony: {agentState: 'Idle', auxCodeId: 'wellness'},
          chat: {agentState: 'Idle', auxCodeId: 'lunch'},
        },
        ['telephony', 'chat'],
        ['chat'],
      ],
      [
        'confirms the complete state when every targeted channel matches',
        {
          telephony: {agentState: 'Idle', auxCodeId: 'wellness'},
          chat: {agentState: 'Idle', auxCodeId: 'wellness'},
        },
        ['telephony', 'chat'],
        [],
      ],
      [
        'requires Available restoration to use the Available auxiliary code',
        {telephony: {agentState: 'Available', auxCodeId: 'wellness'}},
        ['telephony'],
        ['telephony'],
        'Available',
        '0',
      ],
    ])(
      '%s',
      (_label, channelStates, channelTypes, expected, state = 'Idle', auxCodeId = 'wellness') => {
        expect(getUnconfirmedChannelTypes(channelStates, channelTypes, state, auxCodeId)).toEqual(
          expected
        );
      }
    );

    it('waits for a matching state-change event from every target channel', async () => {
      const listeners = {};
      const webex = {
        cc: {
          on: jest.fn((event, listener) => {
            listeners[event] = listener;
          }),
          off: jest.fn((event) => {
            delete listeners[event];
          }),
          getChannelStates: jest.fn(),
        },
      };
      const createConfirmation = loadSampleFunction(
        'function createWellnessChannelConfirmation(',
        '\nfunction captureWellnessBreakContext(',
        {getUnconfirmedChannelTypes, WELLNESS_CHANNEL_CONFIRMATION_TIMEOUT_MS: 1000, webex}
      );
      const targets = ['telephony', 'chat', 'email'];
      const channelStates = Object.fromEntries(
        targets.map((channelType) => [channelType, {agentState: 'Available', auxCodeId: '0'}])
      );
      const confirmation = createConfirmation(targets, 'Available', '0');
      const pending = confirmation.waitFor('rollback-request');
      let settled = false;
      pending.then(() => {
        settled = true;
      });

      listeners['agent:stateChange']({
        requestTrackingId: 'entry-request',
        changedChannels: ['email'],
        channelStates: {
          ...channelStates,
          email: {agentState: 'Idle', auxCodeId: 'wellness'},
        },
      });
      await Promise.resolve();
      expect(settled).toBe(false);

      ['telephony', 'chat'].forEach((channelType) => {
        listeners['agent:stateChange']({
          requestTrackingId: 'rollback-request',
          changedChannels: [channelType],
          channelStates,
        });
      });
      await Promise.resolve();
      expect(settled).toBe(false);

      listeners['agent:stateChange']({
        requestTrackingId: 'rollback-request',
        changedChannels: ['email'],
        channelStates,
      });
      await expect(pending).resolves.toBeUndefined();
      expect(webex.cc.off).toHaveBeenCalledTimes(2);
    });

    it('sends explicit restore targets and awaits their per-channel confirmation', async () => {
      let resolveConfirmation;
      const waitFor = jest.fn(
        () =>
          new Promise((resolve) => {
            resolveConfirmation = resolve;
          })
      );
      const confirmation = {waitFor, dispose: jest.fn()};
      const setWellnessAgentState = jest
        .fn()
        .mockResolvedValue({data: {trackingId: 'rollback-request'}});
      const createConfirmation = jest.fn(() => confirmation);
      const performRestore = loadSampleFunction(
        'async function performSingleWellnessRestore(',
        '\nfunction scheduleLegacyRestoreRecovery(',
        {setWellnessAgentState, createWellnessChannelConfirmation: createConfirmation}
      );
      const targets = ['telephony', 'chat', 'email'];
      const restorePromise = performRestore(targets);
      await new Promise((resolvePromise) => setImmediate(resolvePromise));

      expect(setWellnessAgentState).toHaveBeenCalledWith('Available', {
        reason: 'wellness-break-complete',
        channelType: targets,
      });
      expect(createConfirmation).toHaveBeenCalledWith(targets, 'Available', '0');
      expect(waitFor).toHaveBeenCalledWith('rollback-request');

      resolveConfirmation();
      await expect(restorePromise).resolves.toBeUndefined();
      expect(confirmation.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe('sample public surface guard', () => {
    it('passes every entry target to cleanup when granular wellness entry fails', async () => {
      const targets = ['telephony', 'chat', 'email'];
      const confirmation = {
        waitFor: jest.fn().mockRejectedValue(new Error('Chat entry failed')),
        dispose: jest.fn(),
      };
      const restoreWellnessState = jest.fn().mockResolvedValue(true);
      const wellnessState = {operationGeneration: 0, idleCode: {id: 'wellness'}};
      const enterWellnessBreak = loadSampleFunction(
        'async function enterWellnessBreak(',
        '\nasync function respondToWellnessOffer(',
        {
          clearWellnessOffer: jest.fn(),
          cancelWellnessRestoreRetry: jest.fn(),
          wellnessState,
          captureWellnessBreakContext: jest.fn(),
          isWellnessReady: () => true,
          WELLNESS_COPY: {
            acceptedNotEngaged: 'Accepted.',
            acceptedEngaged: 'Accepted while engaged.',
            startFailure: 'Start failed.',
          },
          setWellnessMessage: jest.fn(),
          areAllTasksSafe: () => true,
          getWellnessTaskList: jest.fn(),
          renderWellnessState: jest.fn(),
          isGranularAgentStateActive: true,
          getSelectableChannelTypes: () => targets,
          createWellnessChannelConfirmation: jest.fn(() => confirmation),
          setWellnessAgentState: jest.fn().mockResolvedValue({data: {trackingId: 'entry-request'}}),
          restoreWellnessState,
          WELLNESS_BREAK_USER_ACTIONS: {ACCEPTED: 'ACCEPTED'},
          webex: {cc: {apiAIAssistant: {respondToWellnessBreak: jest.fn()}}},
          scheduleWellnessSafeStateCheck: jest.fn(),
        }
      );

      await enterWellnessBreak(false);

      expect(restoreWellnessState).toHaveBeenCalledWith({
        forceAvailableChannels: true,
        channelTypes: targets,
        completionMessage: 'The failed wellness transition was cleaned up.',
      });
      expect(confirmation.dispose).toHaveBeenCalledTimes(1);
    });

    it('routes owned mixed-snapshot recovery through the retry lifecycle', () => {
      const appSource = readFileSync(
        resolve(__dirname, '../../../../../../docs/samples/contact-center/app.js'),
        'utf8'
      );

      expect(appSource).toMatch(
        /if \(marker && marker\.agentSessionId === event\.agentSessionId\) \{\s*\/\/ Use the normal restore lifecycle[\s\S]*?void restoreWellnessState\(/m
      );
    });

    it('retries a failed owned mixed-snapshot restore and keeps the recovery marker until success', async () => {
      const wellnessState = {
        operationGeneration: 1,
        agentSessionId: 'session-1',
        lifecycle: 'Ready',
        idleCode: {id: 'wellness'},
        recoveryMarker: {agentSessionId: 'session-1'},
      };
      const channelStates = {
        telephony: {agentState: 'Idle', auxCodeId: 'lunch'},
        chat: {agentState: 'Idle', auxCodeId: 'wellness'},
      };
      const restoreCall = jest
        .fn()
        .mockRejectedValueOnce(new Error('Chat state change failed'))
        .mockImplementationOnce(async () => {
          channelStates.chat.auxCodeId = '0';
        });
      const clearOwnership = jest.fn(() => {
        wellnessState.recoveryMarker = undefined;
      });
      const waitForRetry = jest.fn().mockImplementation(async () => {
        expect(wellnessState.recoveryMarker).toEqual({agentSessionId: 'session-1'});
        return true;
      });
      const restoreWellnessState = loadSampleRestoreWellnessState({
        wellnessState,
        WELLNESS_RESTORE_MAX_ATTEMPTS: 3,
        WELLNESS_RESTORE_RETRY_MS: 10000,
        WELLNESS_COPY: {restoreFailure: 'Restoration failed.'},
        clearWellnessBreakTimer: jest.fn(),
        clearWellnessSafeStateTimer: jest.fn(),
        setWellnessMessage: jest.fn(),
        renderWellnessState: jest.fn(),
        performSingleWellnessRestore: restoreCall,
        waitForWellnessRestoreRetry: waitForRetry,
        clearWellnessLifecycleOwnership: clearOwnership,
        scheduleLegacyRestoreRecovery: jest.fn(),
        isWellnessReady: () => true,
        webex: {cc: {getChannelStates: () => channelStates}},
      });

      await expect(restoreWellnessState()).resolves.toBe(true);

      expect(restoreCall).toHaveBeenCalledTimes(2);
      expect(waitForRetry).toHaveBeenCalledWith(10000, 1);
      expect(clearOwnership).toHaveBeenCalledTimes(1);
      expect(wellnessState.recoveryMarker).toBeUndefined();
      expect(wellnessState.lifecycle).toBe('Ready');
    });

    it('retries when the SDK resolves before every wellness channel confirms restoration', async () => {
      const wellnessState = {
        operationGeneration: 1,
        agentSessionId: 'session-1',
        lifecycle: 'Ready',
        idleCode: {id: 'wellness'},
        recoveryMarker: {agentSessionId: 'session-1'},
      };
      const channelStates = {
        telephony: {agentState: 'Idle', auxCodeId: 'lunch'},
        chat: {agentState: 'Idle', auxCodeId: 'wellness'},
      };
      const restoreCall = jest
        .fn()
        .mockImplementationOnce(async () => {})
        .mockImplementationOnce(async () => {
          channelStates.chat.auxCodeId = '0';
        });
      const clearOwnership = jest.fn(() => {
        wellnessState.recoveryMarker = undefined;
      });
      const waitForRetry = jest.fn().mockImplementation(async () => {
        expect(wellnessState.recoveryMarker).toEqual({agentSessionId: 'session-1'});
        return true;
      });
      const restoreWellnessState = loadSampleRestoreWellnessState({
        wellnessState,
        WELLNESS_RESTORE_MAX_ATTEMPTS: 3,
        WELLNESS_RESTORE_RETRY_MS: 10000,
        WELLNESS_COPY: {restoreFailure: 'Restoration failed.'},
        clearWellnessBreakTimer: jest.fn(),
        clearWellnessSafeStateTimer: jest.fn(),
        setWellnessMessage: jest.fn(),
        renderWellnessState: jest.fn(),
        performSingleWellnessRestore: restoreCall,
        waitForWellnessRestoreRetry: waitForRetry,
        clearWellnessLifecycleOwnership: clearOwnership,
        scheduleLegacyRestoreRecovery: jest.fn(),
        isWellnessReady: () => true,
        webex: {cc: {getChannelStates: () => channelStates}},
      });

      await expect(restoreWellnessState()).resolves.toBe(true);

      expect(restoreCall).toHaveBeenCalledTimes(2);
      expect(waitForRetry).toHaveBeenCalledWith(10000, 1);
      expect(clearOwnership).toHaveBeenCalledTimes(1);
      expect(wellnessState.recoveryMarker).toBeUndefined();
    });

    it('recognizes delayed all-channel confirmation before issuing a retry', async () => {
      const wellnessState = {
        operationGeneration: 1,
        agentSessionId: 'session-1',
        lifecycle: 'Ready',
        idleCode: {id: 'wellness'},
        recoveryMarker: {agentSessionId: 'session-1'},
      };
      const channelStates = {
        telephony: {agentState: 'Idle', auxCodeId: 'lunch'},
        chat: {agentState: 'Idle', auxCodeId: 'wellness'},
      };
      const performRestore = jest
        .fn()
        .mockRejectedValueOnce(new Error('Chat confirmation is delayed'));
      const clearOwnership = jest.fn(() => {
        wellnessState.recoveryMarker = undefined;
      });
      const restoreWellnessState = loadSampleRestoreWellnessState({
        wellnessState,
        WELLNESS_RESTORE_MAX_ATTEMPTS: 3,
        WELLNESS_RESTORE_RETRY_MS: 10000,
        WELLNESS_COPY: {restoreFailure: 'Restoration failed.'},
        clearWellnessBreakTimer: jest.fn(),
        clearWellnessSafeStateTimer: jest.fn(),
        setWellnessMessage: jest.fn(),
        renderWellnessState: jest.fn(),
        performSingleWellnessRestore: performRestore,
        waitForWellnessRestoreRetry: jest.fn().mockImplementation(async () => {
          channelStates.chat.auxCodeId = '0';
          return true;
        }),
        clearWellnessLifecycleOwnership: clearOwnership,
        scheduleLegacyRestoreRecovery: jest.fn(),
        isWellnessReady: () => true,
        webex: {cc: {getChannelStates: () => channelStates}},
      });

      await expect(restoreWellnessState()).resolves.toBe(true);

      expect(performRestore).toHaveBeenCalledTimes(1);
      expect(clearOwnership).toHaveBeenCalledTimes(1);
      expect(wellnessState.recoveryMarker).toBeUndefined();
      expect(wellnessState.lifecycle).toBe('Ready');
    });

    it('retries failed-entry cleanup with every original channel target', async () => {
      const targets = ['telephony', 'chat', 'email'];
      const wellnessState = {
        operationGeneration: 1,
        agentSessionId: 'session-1',
        lifecycle: 'ChangingToBreak',
        idleCode: {id: 'wellness'},
        recoveryMarker: {agentSessionId: 'session-1'},
      };
      const channelStates = {
        telephony: {agentState: 'Idle', auxCodeId: 'wellness'},
        chat: {agentState: 'Available', auxCodeId: '0'},
        email: {agentState: 'Idle', auxCodeId: 'wellness'},
      };
      const restoreCall = jest
        .fn()
        .mockImplementationOnce(async (channelTypes) => {
          expect(channelTypes).toEqual(targets);
          channelStates.telephony = {agentState: 'Available', auxCodeId: '0'};
          channelStates.chat = {agentState: 'Available', auxCodeId: '0'};
        })
        .mockImplementationOnce(async (channelTypes) => {
          expect(channelTypes).toEqual(targets);
          channelStates.email = {agentState: 'Available', auxCodeId: '0'};
        });
      const waitForRetry = jest.fn().mockImplementation(async () => {
        expect(wellnessState.recoveryMarker).toEqual({agentSessionId: 'session-1'});
        return true;
      });
      const clearOwnership = jest.fn(() => {
        wellnessState.recoveryMarker = undefined;
      });
      const restoreWellnessState = loadSampleRestoreWellnessState({
        wellnessState,
        WELLNESS_RESTORE_MAX_ATTEMPTS: 3,
        WELLNESS_RESTORE_RETRY_MS: 10000,
        WELLNESS_COPY: {restoreFailure: 'Restoration failed.'},
        clearWellnessBreakTimer: jest.fn(),
        clearWellnessSafeStateTimer: jest.fn(),
        setWellnessMessage: jest.fn(),
        renderWellnessState: jest.fn(),
        performSingleWellnessRestore: restoreCall,
        waitForWellnessRestoreRetry: waitForRetry,
        clearWellnessLifecycleOwnership: clearOwnership,
        scheduleLegacyRestoreRecovery: jest.fn(),
        isWellnessReady: () => true,
        webex: {cc: {getChannelStates: () => channelStates}},
      });

      await expect(
        restoreWellnessState({forceAvailableChannels: true, channelTypes: targets})
      ).resolves.toBe(true);

      expect(restoreCall).toHaveBeenCalledTimes(2);
      expect(waitForRetry).toHaveBeenCalledWith(10000, 1);
      expect(clearOwnership).toHaveBeenCalledTimes(1);
      expect(wellnessState.recoveryMarker).toBeUndefined();
      expect(wellnessState.lifecycle).toBe('Ready');
    });

    it('attaches the wellness constants consumed by the standalone browser sample', () => {
      const webexSource = readFileSync(resolve(__dirname, '../../../src/webex.js'), 'utf8');
      const appSource = readFileSync(
        resolve(__dirname, '../../../../../../docs/samples/contact-center/app.js'),
        'utf8'
      );

      ['WELLNESS_BREAK_NOTIFICATION_ACTIONS', 'WELLNESS_BREAK_USER_ACTIONS'].forEach((surface) => {
        expect(webexSource).toContain(`Webex.${surface} = ${surface};`);
        expect(appSource).toContain(surface);
      });
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
          JSON.stringify({
            version: 1,
            agentSessionId: 'session-1',
            stateModel: 'agent-state-control',
          })
        )
      ).toBeUndefined();
    });
  });
});
