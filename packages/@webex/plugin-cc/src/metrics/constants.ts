type Enum<T extends Record<string, unknown>> = T[keyof T];

export const METRIC_EVENT_NAMES = {
  STATION_LOGIN: 'Station Login',
  CALL_COMPLETED: 'Call Completed',
  TASK_END: 'Task End',
  CALL_CONSULT_ACTIVATE: 'Call Consult Activate',
  CALL_TRANSFER_ACTIVATE: 'Call Transfer Activated',
  CALL_ANSWERED: 'Call Answered',
  AGENT_RONA: 'Agent RONA',
} as const;

// Derive the type using the utility type
export type METRIC_EVENT_NAMES = Enum<typeof METRIC_EVENT_NAMES>;
