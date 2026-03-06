export const BASE_URL = process.env.PW_BASE_URL || 'https://localhost:8000/samples/contact-center/';

export const USER_STATES = {
  MEETING: 'Meeting',
  AVAILABLE: 'Available',
  LUNCH: 'Lunch Break',
  RONA: 'RONA',
  ENGAGED: 'Engaged',
  AGENT_DECLINED: 'Agent_Declined',
};

export type userState = (typeof USER_STATES)[keyof typeof USER_STATES];

export const THEME_COLORS = {
  AVAILABLE: 'rgb(206, 245, 235)',
  MEETING: 'rgba(0, 0, 0, 0.11)',
  ENGAGED: 'rgb(255, 235, 194)',
  RONA: 'rgb(250, 233, 234)',
};

export type ThemeColor = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

export const LOGIN_MODE = {
  DESKTOP: 'Desktop',
  EXTENSION: 'Extension',
  DIAL_NUMBER: 'Dial Number',
};

export type LoginMode = (typeof LOGIN_MODE)[keyof typeof LOGIN_MODE];

export const EXTENSION_REGISTRATION_TIMEOUT = 40000;

// Universal timeout for all await operations in Playwright tests
export const AWAIT_TIMEOUT = 10000;

// Test Manager Constants
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_TIMEOUT = 5000;

// Consolidated timeout constants by duration and usage
export const UI_SETTLE_TIMEOUT = 2000;
export const FORM_FIELD_TIMEOUT = 20000;
export const OPERATION_TIMEOUT = 30000;
export const NETWORK_OPERATION_TIMEOUT = 40000;

// Specific timeouts for incoming task operations
export const CHAT_LAUNCHER_TIMEOUT = 60000;
export const ACCEPT_TASK_TIMEOUT = 60000;

// Widget initialization timeouts
export const WIDGET_INIT_TIMEOUT = 50000;

// Wrapup timeouts
export const WRAPUP_TIMEOUT = 15000;

// Station login timeouts
export const DROPDOWN_SETTLE_TIMEOUT = 200;

// Console log patterns for state changes
export const CONSOLE_PATTERNS = {
  SDK_STATE_CHANGE_SUCCESS: 'WXCC_SDK_AGENT_STATE_CHANGE_SUCCESS',
  ON_STATE_CHANGE_REGEX: /onStateChange invoked with state name:\s*(.+)/i,
  ON_STATE_CHANGE_KEYWORDS: ['onstatechange', 'invoked'],
};

// Page Types for Test Manager
export const PAGE_TYPES = {
  AGENT1: 'agent1',
  AGENT2: 'agent2',
  CALLER: 'caller',
  EXTENSION: 'extension',
  CHAT: 'chat',
  MULTI_SESSION: 'multiSession',
  DIAL_NUMBER: 'dialNumber',
};

export type PageType = (typeof PAGE_TYPES)[keyof typeof PAGE_TYPES];

export const CALL_URL = 'https://web-sdk.webex.com/samples/calling/';

export const TASK_TYPES = {
  CALL: 'Call',
  CHAT: 'Chat',
  EMAIL: 'Email',
  SOCIAL: 'Social',
};

export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES];

export const WRAPUP_REASONS = {
  SALE: 'Sale',
  RESOLVED: 'Resolved',
};

export type WrapupReason = (typeof WRAPUP_REASONS)[keyof typeof WRAPUP_REASONS];

export const RONA_OPTIONS = {
  AVAILABLE: 'Available',
  IDLE: 'Idle',
};

export type RonaOption = (typeof RONA_OPTIONS)[keyof typeof RONA_OPTIONS];

// Test Data Constants
export const TEST_DATA = {
  CHAT_NAME: 'Playwright Test',
  CHAT_EMAIL: 'playwright@test.com',
  EMAIL_TEXT: '--This Email is generated due to playwright automation test for incoming Tasks---',
  EXTENSION_CALL_INDICATOR: 'Ringing...',
};
