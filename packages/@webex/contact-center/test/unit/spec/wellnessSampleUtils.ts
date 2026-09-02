const {
  areAllTasksSafe,
  buildAscRestoreGroups,
  createRecoveryMarker,
  getLegacyExternalTransitionDecision,
  getRecoveryDecision,
  getSelectableIdleCodes,
  hasOwnedAscTransition,
  isExternalSystemIdle,
  parseRecoveryMarker,
} = require('../../../../../../docs/samples/contact-center/wellness-utils');
const {readFileSync} = require('fs');
const {resolve} = require('path');

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

  describe('Agent State Control restoration', () => {
    it('groups exact captured idle targets and Available sequential targets', () => {
      const groups = buildAscRestoreGroups({
        channelTypes: ['telephony', 'chat', 'email', 'social'],
        currentChannelStates: {
          telephony: {
            agentState: 'Idle',
            pendingIdle: false,
            auxCodeId: 'wellness',
          },
          chat: {
            agentState: 'Idle',
            pendingIdle: false,
            auxCodeId: 'wellness',
          },
          email: {
            agentState: 'Engaged',
            pendingIdle: true,
          },
          social: {
            agentState: 'Idle',
            pendingIdle: false,
            auxCodeId: 'rona-code',
          },
        },
        preBreakChannelStates: {
          telephony: {agentState: 'Idle', auxCodeId: 'training'},
          chat: {agentState: 'Available', auxCodeId: null},
          email: {agentState: 'Available', auxCodeId: null},
          social: {agentState: 'Available', auxCodeId: null},
        },
        wellnessAuxCodeId: 'wellness',
        validIdleCodeIds: ['training', 'default-idle'],
        defaultIdleCodeId: 'default-idle',
      });

      expect(groups).toEqual([
        {state: 'Idle', auxCodeId: 'training', channelTypes: ['telephony']},
        {state: 'Available', channelTypes: ['chat', 'email']},
      ]);
    });

    it('uses the default idle code only for a captured Idle state with an invalid target', () => {
      const groups = buildAscRestoreGroups({
        channelTypes: ['chat', 'email'],
        currentChannelStates: {
          chat: {agentState: 'Idle', pendingIdle: false, auxCodeId: 'wellness'},
          email: {agentState: 'Idle', pendingIdle: false, auxCodeId: 'wellness'},
        },
        preBreakChannelStates: {
          chat: {agentState: 'Idle', auxCodeId: 'system-idle'},
          email: {agentState: 'Available', auxCodeId: null},
        },
        wellnessAuxCodeId: 'wellness',
        validIdleCodeIds: ['default-idle'],
        defaultIdleCodeId: 'default-idle',
      });

      expect(groups).toEqual([
        {state: 'Idle', auxCodeId: 'default-idle', channelTypes: ['chat']},
        {state: 'Available', channelTypes: ['email']},
      ]);
    });

    it('leaves a channel already in RONA or another external idle state unchanged', () => {
      expect(
        isExternalSystemIdle(
          {agentState: 'Idle', pendingIdle: false, auxCodeId: 'rona-code'},
          'wellness'
        )
      ).toBe(true);
      expect(
        buildAscRestoreGroups({
          channelTypes: ['telephony'],
          currentChannelStates: {
            telephony: {agentState: 'Idle', pendingIdle: false, auxCodeId: 'rona-code'},
          },
          preBreakChannelStates: {
            telephony: {agentState: 'Available', auxCodeId: null},
          },
          wellnessAuxCodeId: 'wellness',
          validIdleCodeIds: [],
        })
      ).toEqual([]);
    });

    it('restores unconfirmed channels after a failed state request without overwriting RONA', () => {
      expect(
        buildAscRestoreGroups({
          channelTypes: ['telephony', 'chat', 'email'],
          currentChannelStates: {
            telephony: {agentState: 'Available', pendingIdle: false},
            chat: {agentState: 'Available', pendingIdle: false},
            email: {agentState: 'Idle', pendingIdle: false, auxCodeId: 'rona-code'},
          },
          preBreakChannelStates: {
            telephony: {agentState: 'Idle', auxCodeId: 'training'},
            chat: {agentState: 'Available', auxCodeId: null},
            email: {agentState: 'Available', auxCodeId: null},
          },
          wellnessAuxCodeId: 'wellness',
          validIdleCodeIds: ['training'],
          includeUnconfirmedChannels: true,
        })
      ).toEqual([
        {state: 'Idle', auxCodeId: 'training', channelTypes: ['telephony']},
        {state: 'Available', channelTypes: ['chat']},
      ]);
    });

    it('reports whether any managed channel still owns wellness or pending Idle', () => {
      expect(
        hasOwnedAscTransition(
          ['chat', 'email'],
          {
            chat: {agentState: 'Available', pendingIdle: false},
            email: {agentState: 'Engaged', pendingIdle: true},
          },
          'wellness'
        )
      ).toBe(true);
      expect(
        hasOwnedAscTransition(
          ['chat'],
          {chat: {agentState: 'Available', pendingIdle: false}},
          'wellness'
        )
      ).toBe(false);
    });
  });

  describe('external state synchronization', () => {
    it.each([
      ['agent-state-control', 'OnBreak', '0', 'complete'],
      ['agent-state-control', 'OnBreak', 'rona-code', 'ignore'],
      ['legacy', 'OnBreak', 'user-idle', 'complete'],
      ['legacy', 'OnBreak', 'rona-code', 'ignore'],
      ['legacy', 'WaitingForSafeState', 'rona-code', 'cancel'],
      ['legacy', 'Ready', '0', 'ignore'],
    ])(
      'returns %s / %s / %s as %s',
      (stateModel, lifecycle, nextAuxCodeId, expected) => {
        expect(
          getLegacyExternalTransitionDecision({
            stateModel,
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

  describe('sample privacy guard', () => {
    it('does not log the full agent/session or AI payloads identified by validation', () => {
      const appSource = readFileSync(
        resolve(__dirname, '../../../../../../docs/samples/contact-center/app.js'),
        'utf8'
      );

      [
        "console.log('Event subscription successful: ', agentProfile)",
        "console.log('Agent re-login successful', data)",
        "console.log('Agent station-login success', data)",
        "console.log('Agent Logged in successfully', response)",
        "console.log('Profile updated', resp)",
        "console.info('Received real-time transcription:', payload)",
        "console.info('Received suggested response:', payload)",
        "console.log('Task clicked:', task)",
        "console.log('Destination:', destination)",
        "console.log('Selected ANI:', selectedAni",
        "console.log('Outdial call initiated successfully with ANI:', selectedAni)",
        "console.log('[CampaignPreview] Accept SUCCESS - result:',",
        "console.log('[CampaignPreview] Skip SUCCESS - result:',",
        "console.log('[CampaignPreview] Remove SUCCESS - result:',",
        "console.error('[CampaignPreview] Error details:',",
        "console.log('[CampaignPreview] task:end — campaign preview fields:',",
        "console.log('[CampaignPreview] task:campaignContactUpdated — campaign preview fields:',",
      ].forEach((unsafeLog) => expect(appSource).not.toContain(unsafeLog));
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

  describe('browser recovery marker', () => {
    it('round-trips only session ownership and minimal restore state', () => {
      const marker = createRecoveryMarker({
        agentSessionId: 'session-1',
        stateModel: 'agent-state-control',
        channelTypes: ['chat'],
        preBreakChannelStates: {
          chat: {
            agentState: 'Idle',
            auxCodeId: 'training',
            stateChangeReason: 'not-persisted',
          },
        },
      });

      expect(parseRecoveryMarker(JSON.stringify(marker))).toEqual({
        version: 1,
        agentSessionId: 'session-1',
        stateModel: 'agent-state-control',
        channelTypes: ['chat'],
        preBreakChannelStates: {
          chat: {agentState: 'Idle', auxCodeId: 'training'},
        },
      });
    });

    it.each([
      {
        name: 'discards another session',
        input: {
          marker: createRecoveryMarker({
            agentSessionId: 'session-1',
            stateModel: 'legacy',
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
            stateModel: 'legacy',
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
            stateModel: 'legacy',
          }),
          agentSessionId: 'session-1',
          legacyStateKnown: true,
          legacyAuxCodeId: 'wellness',
          wellnessAuxCodeId: 'wellness',
        },
        expected: 'restore',
      },
      {
        name: 'restores an ASC pending idle transition',
        input: {
          marker: createRecoveryMarker({
            agentSessionId: 'session-1',
            stateModel: 'agent-state-control',
            channelTypes: ['chat'],
          }),
          agentSessionId: 'session-1',
          wellnessAuxCodeId: 'wellness',
          ascSnapshotKnown: true,
          currentChannelStates: {
            chat: {agentState: 'Engaged', pendingIdle: true},
          },
        },
        expected: 'restore',
      },
      {
        name: 'clears a legacy marker when the session already left wellness',
        input: {
          marker: createRecoveryMarker({
            agentSessionId: 'session-1',
            stateModel: 'legacy',
          }),
          agentSessionId: 'session-1',
          legacyStateKnown: true,
          legacyAuxCodeId: '0',
          wellnessAuxCodeId: 'wellness',
        },
        expected: 'clear',
      },
      {
        name: 'clears an ASC marker when every channel already left wellness',
        input: {
          marker: createRecoveryMarker({
            agentSessionId: 'session-1',
            stateModel: 'agent-state-control',
            channelTypes: ['chat'],
          }),
          agentSessionId: 'session-1',
          wellnessAuxCodeId: 'wellness',
          ascSnapshotKnown: true,
          currentChannelStates: {
            chat: {agentState: 'Available', pendingIdle: false},
          },
        },
        expected: 'clear',
      },
    ])('$name', ({input, expected}) => {
      expect(getRecoveryDecision(input)).toBe(expected);
    });

    it('rejects malformed or unsupported recovery markers', () => {
      expect(parseRecoveryMarker('{')).toBeUndefined();
      expect(parseRecoveryMarker(JSON.stringify({version: 2}))).toBeUndefined();
    });
  });
});
