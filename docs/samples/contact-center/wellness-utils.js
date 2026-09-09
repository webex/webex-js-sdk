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

  function getLegacyExternalTransitionDecision({
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
    const isLikelySystemIdle =
      nextAuxCodeId !== '0' && !(validIdleCodeIds || []).includes(nextAuxCodeId);
    return lifecycle === 'OnBreak' && isLikelySystemIdle ? 'ignore' : 'complete';
  }

  function createRecoveryMarker({agentSessionId}) {
    return {
      version: 1,
      agentSessionId,
      stateModel: 'legacy',
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
        marker.stateModel !== 'legacy'
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
  }) {
    if (!marker || marker.agentSessionId !== agentSessionId) return 'discard';

    if (!legacyStateKnown) return 'wait';
    return legacyAuxCodeId === wellnessAuxCodeId ? 'restore' : 'clear';
  }

  return {
    areAllTasksSafe,
    createRecoveryMarker,
    getLegacyExternalTransitionDecision,
    getRecoveryDecision,
    getSelectableIdleCodes,
    isTaskBlockingWellness,
    normalizeState,
    parseRecoveryMarker,
  };
});
