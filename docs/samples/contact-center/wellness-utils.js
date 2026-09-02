(function exposeWellnessSampleUtils(root, factory) {
  const utils = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = utils;
  }

  if (root) {
    root.WellnessSampleUtils = utils;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWellnessSampleUtils() {
  const TERMINAL_TASK_STATES = new Set([
    'completed',
    'disconnected',
    'ended',
    'terminated',
    'wrappedup',
  ]);
  const BUSY_CHANNEL_STATES = new Set([
    'engaged',
    'engagedother',
    'reserved',
    'wrapup',
    'wrapping_up',
  ]);
  const PRE_PLAY_LIFECYCLES = new Set([
    'ChangingToBreak',
    'WaitingForSafeState',
    'Starting',
  ]);

  function normalizeState(value) {
    return typeof value === 'string' ? value.replace(/[\s-]/g, '').toLowerCase() : '';
  }

  function isTaskBlockingWellness(task) {
    if (!task) return false;
    const data = task.data;
    if (!data) return true;
    if (data.wrapUpRequired === true) return true;

    const state = normalizeState(data.interaction?.state);
    return !state || !TERMINAL_TASK_STATES.has(state);
  }

  function areAllTasksSafe(taskList) {
    return Object.values(taskList || {}).every((task) => !isTaskBlockingWellness(task));
  }

  function getSelectableIdleCodes(idleCodes) {
    return (idleCodes || []).filter((idleCode) => idleCode?.isSystem === false);
  }

  function cloneChannelStates(channelTypes, channelStateDetails) {
    return [...new Set(channelTypes)].reduce((snapshot, channelType) => {
      const detail = channelStateDetails?.[channelType];
      if (detail) {
        snapshot[channelType] = {
          agentState: detail.agentState,
          auxCodeId: detail.auxCodeId ?? null,
        };
      }
      return snapshot;
    }, {});
  }

  function isWellnessChannelDetail(detail, wellnessAuxCodeId) {
    return (
      normalizeState(detail?.agentState) === 'idle' &&
      detail?.pendingIdle === false &&
      detail?.auxCodeId === wellnessAuxCodeId
    );
  }

  function isExternalSystemIdle(detail, wellnessAuxCodeId) {
    return (
      normalizeState(detail?.agentState) === 'idle' &&
      Boolean(detail?.auxCodeId) &&
      detail.auxCodeId !== wellnessAuxCodeId
    );
  }

  function hasOwnedAscTransition(channelTypes, currentChannelStates, wellnessAuxCodeId) {
    return (channelTypes || []).some((channelType) => {
      const detail = currentChannelStates?.[channelType];
      return (
        isWellnessChannelDetail(detail, wellnessAuxCodeId) || detail?.pendingIdle === true
      );
    });
  }

  function getLegacyExternalTransitionDecision({
    stateModel,
    lifecycle,
    nextAuxCodeId,
    wellnessAuxCodeId,
    validIdleCodeIds,
  }) {
    if (!wellnessAuxCodeId || nextAuxCodeId === wellnessAuxCodeId) return 'ignore';
    if (PRE_PLAY_LIFECYCLES.has(lifecycle)) return 'cancel';

    if (!['OnBreak', 'ActionDeliveryFailed', 'RestoreFailed'].includes(lifecycle)) {
      return 'ignore';
    }
    if (stateModel === 'agent-state-control') {
      return nextAuxCodeId === '0' ? 'complete' : 'ignore';
    }

    const isLikelySystemIdle =
      nextAuxCodeId !== '0' && !(validIdleCodeIds || []).includes(nextAuxCodeId);
    return lifecycle === 'OnBreak' && isLikelySystemIdle ? 'ignore' : 'complete';
  }

  function buildAscRestoreGroups({
    channelTypes,
    currentChannelStates,
    preBreakChannelStates,
    wellnessAuxCodeId,
    validIdleCodeIds,
    defaultIdleCodeId,
    includeUnconfirmedChannels = false,
  }) {
    const validIdleCodes = new Set(validIdleCodeIds || []);
    const groups = new Map();

    [...new Set(channelTypes || [])].forEach((channelType) => {
      const current = currentChannelStates?.[channelType];
      const currentState = normalizeState(current?.agentState);
      let target;

      if (BUSY_CHANNEL_STATES.has(currentState)) {
        target = {state: 'Available'};
      } else if (isExternalSystemIdle(current, wellnessAuxCodeId)) {
        return;
      } else if (
        !isWellnessChannelDetail(current, wellnessAuxCodeId) &&
        !includeUnconfirmedChannels
      ) {
        return;
      } else {
        const captured = preBreakChannelStates?.[channelType];
        const capturedState = normalizeState(captured?.agentState);
        const capturedAuxCodeId = captured?.auxCodeId;

        if (
          capturedState === 'idle' &&
          capturedAuxCodeId &&
          capturedAuxCodeId !== wellnessAuxCodeId &&
          validIdleCodes.has(capturedAuxCodeId)
        ) {
          target = {state: 'Idle', auxCodeId: capturedAuxCodeId};
        } else if (
          capturedState === 'idle' &&
          defaultIdleCodeId &&
          validIdleCodes.has(defaultIdleCodeId)
        ) {
          target = {state: 'Idle', auxCodeId: defaultIdleCodeId};
        } else {
          target = {state: 'Available'};
        }
      }

      const key = [target.state, target.auxCodeId || ''].join(':');
      if (!groups.has(key)) {
        groups.set(key, {...target, channelTypes: []});
      }
      groups.get(key).channelTypes.push(channelType);
    });

    return [...groups.values()];
  }

  function createRecoveryMarker({
    agentSessionId,
    stateModel,
    channelTypes,
    preBreakChannelStates,
  }) {
    return {
      version: 1,
      agentSessionId,
      stateModel,
      ...(stateModel === 'agent-state-control'
        ? {
            channelTypes: [...new Set(channelTypes || [])],
            preBreakChannelStates: cloneChannelStates(
              channelTypes || [],
              preBreakChannelStates || {}
            ),
          }
        : {}),
    };
  }

  function parseRecoveryMarker(serialized) {
    if (!serialized) return undefined;

    try {
      const marker = JSON.parse(serialized);
      if (
        marker?.version !== 1 ||
        typeof marker.agentSessionId !== 'string' ||
        !marker.agentSessionId ||
        !['legacy', 'agent-state-control'].includes(marker.stateModel)
      ) {
        return undefined;
      }

      if (
        marker.stateModel === 'agent-state-control' &&
        (!Array.isArray(marker.channelTypes) ||
          marker.channelTypes.some((channelType) => typeof channelType !== 'string'))
      ) {
        return undefined;
      }

      return createRecoveryMarker(marker);
    } catch {
      return undefined;
    }
  }

  function getRecoveryDecision({
    marker,
    agentSessionId,
    wellnessAuxCodeId,
    legacyStateKnown,
    legacyAuxCodeId,
    ascSnapshotKnown,
    currentChannelStates,
  }) {
    if (!marker || marker.agentSessionId !== agentSessionId) return 'discard';

    if (marker.stateModel === 'legacy') {
      if (!legacyStateKnown) return 'wait';
      return legacyAuxCodeId === wellnessAuxCodeId ? 'restore' : 'clear';
    }

    if (!ascSnapshotKnown) return 'wait';
    const requiresRestore = (marker.channelTypes || []).some((channelType) => {
      const detail = currentChannelStates?.[channelType];
      return isWellnessChannelDetail(detail, wellnessAuxCodeId) || detail?.pendingIdle === true;
    });
    return requiresRestore ? 'restore' : 'clear';
  }

  return {
    areAllTasksSafe,
    buildAscRestoreGroups,
    cloneChannelStates,
    createRecoveryMarker,
    getLegacyExternalTransitionDecision,
    getRecoveryDecision,
    getSelectableIdleCodes,
    hasOwnedAscTransition,
    isExternalSystemIdle,
    isTaskBlockingWellness,
    isWellnessChannelDetail,
    normalizeState,
    parseRecoveryMarker,
  };
});
