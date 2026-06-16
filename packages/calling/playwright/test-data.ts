/**
 * User set definitions for parallel test execution.
 *
 * Each set owns one or more accounts and maps to a single suite file.
 * Playwright projects ensure sets using different accounts run in parallel,
 * while sets sharing accounts are ordered via project dependencies.
 *
 * Account constraint: the same Webex account must NEVER be active
 * in two browser sessions simultaneously.
 */

export type AccountRole = 'USER_1' | 'USER_2' | 'USER_3' | 'USER_4' | 'USER_5' | 'USER_6';

export interface UserSet {
  /** Human-readable name shown in Playwright reporter */
  name: string;
  /** Account roles this set requires (order matters for multi-user: first is "primary") */
  accounts: AccountRole[];
  /** Suite file matched by the Playwright project's testMatch */
  testSuite: string;
}

export type MobiusMode = 'http' | 'ws';

/**
 * Roles that must have credentials/tokens available for the currently enabled
 * Playwright projects. USER_6 is required for SET_CONTACTS (contacts suite).
 */
export const REQUIRED_OAUTH_ROLES: AccountRole[] = [
  'USER_1',
  'USER_2',
  'USER_3',
  'USER_4',
  'USER_5',
  'USER_6',
];

/** Separator between set name and environment in project names (e.g. "SET_REGISTRATION_1 - PROD"). */
const ENV_SEPARATOR = ' - ';

/**
 * Mobius transport mode for Playwright suites.
 *
 * MOBIUS=ws forces the sample app WebSocket override before SDK initialization.
 * MOBIUS=http keeps the default HTTP transport.
 */
export const getMobiusMode = (): MobiusMode => {
  const mode = process.env.MOBIUS?.toLowerCase();

  if (mode === 'ws') {
    return 'ws';
  }

  return 'http';
};

export const isMobiusWsMode = (): boolean => getMobiusMode() === 'ws';

/**
 * Whether a Playwright project targets the Integration environment.
 */
export const isIntProject = (projectName: string): boolean =>
  projectName.endsWith(`${ENV_SEPARATOR}INT`);

/**
 * Strip the environment suffix (e.g. ` - INT`, ` - PROD`) from a project name
 * so it can be looked up in USER_SETS.
 */
export const baseProjectName = (projectName: string): string => {
  const idx = projectName.lastIndexOf(ENV_SEPARATOR);

  return idx === -1 ? projectName : projectName.slice(0, idx);
};

/**
 * Token env var name for a given account role and environment.
 */
export const tokenEnvVar = (role: AccountRole, isInt = false): string =>
  isInt ? `${role}_INT_ACCESS_TOKEN` : `${role}_ACCESS_TOKEN`;

/**
 * Read access token for an account role. Throws if not set.
 */
export const getToken = (role: AccountRole, isInt = false): string => {
  const envVar = tokenEnvVar(role, isInt);
  const token = process.env[envVar];
  if (!token) {
    throw new Error(`${envVar} not set. Run OAuth setup first.`);
  }

  return token;
};

/** Env var for E.164 (or test) phone number, production vs integration Playwright projects. */
export const phoneEnvVar = (role: AccountRole, isInt = false): string =>
  isInt ? `${role}_INT_PHONE_NUMBER` : `${role}_PHONE_NUMBER`;

/**
 * Read phone number for an account role. Throws if not set.
 * Integration projects use `USER_N_INT_PHONE_NUMBER`; production uses `USER_N_PHONE_NUMBER`.
 */
export const getPhoneNumber = (role: AccountRole, isInt = false): string => {
  const envVar = phoneEnvVar(role, isInt);
  const number = process.env[envVar];
  if (!number) {
    throw new Error(`${envVar} not set.`);
  }

  return number;
};

// ---------------------------------------------------------------------------
// User sets — single source of truth for account-to-suite mapping.
// Keyed by Playwright project name (testInfo.project.name).
// ---------------------------------------------------------------------------

export const USER_SETS: Record<string, UserSet> = {
  // Single-user registration tests (parallel, ~4min each)
  SET_REGISTRATION_1: {
    name: 'SET_REGISTRATION_1',
    accounts: ['USER_1'],
    testSuite: 'set-registration-1.spec.ts',
  },
  SET_REGISTRATION_2: {
    name: 'SET_REGISTRATION_2',
    accounts: ['USER_2'],
    testSuite: 'set-registration-2.spec.ts',
  },
  SET_REGISTRATION_3: {
    name: 'SET_REGISTRATION_3',
    accounts: ['USER_3'],
    testSuite: 'set-registration-3.spec.ts',
  },

  // 2-user call tests (PROD — dedicated accounts, parallel with registration)
  SET_CALL: {
    name: 'SET_CALL',
    accounts: ['USER_4', 'USER_5'],
    testSuite: 'set-call.spec.ts',
  },

  // Call History uses USER_1+USER_2 after their single-user suites complete,
  // so it can run alongside the SET_CALL call lifecycle suite in PROD.
  SET_CALL_HISTORY: {
    name: 'SET_CALL_HISTORY',
    accounts: ['USER_1', 'USER_2'],
    testSuite: 'call-history.spec.ts',
  },

  // 3-user transfer tests (PROD — dedicated accounts, parallel with registration)
  SET_CALL_TRANSFER_CONSULT: {
    name: 'SET_CALL_TRANSFER_CONSULT',
    accounts: ['USER_1', 'USER_2', 'USER_3'],
    testSuite: 'set-call-transfer-consult.spec.ts',
  },

  // Single-user Contacts supplementary service E2E tests
  SET_CONTACTS: {
    name: 'SET_CONTACTS',
    accounts: ['USER_6'],
    testSuite: 'contacts.spec.ts',
  },

  // Call Settings E2E tests:
  //   accounts[0] = USER_3 — settings owner / callee
  //   accounts[1] = USER_2 — primary caller (also used for busy-state first call)
  //   accounts[2] = USER_1 — second caller (places call while USER_3 is already busy)
  SET_CALL_SETTINGS: {
    name: 'SET_CALL_SETTINGS',
    accounts: ['USER_3', 'USER_2', 'USER_1'],
    testSuite: 'set-call-settings.spec.ts',
  },
};

/**
 * Look up a UserSet by Playwright project name. Throws if not found.
 */
export const getUserSet = (projectName: string): UserSet => {
  const key = baseProjectName(projectName);
  const set = USER_SETS[key];
  if (!set) {
    throw new Error(
      `No UserSet for project "${projectName}" (resolved key: "${key}"). ` +
        `Known sets: ${Object.keys(USER_SETS).join(', ')}`
    );
  }

  return set;
};
