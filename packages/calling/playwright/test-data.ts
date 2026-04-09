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

export type AccountRole = 'USER_1' | 'USER_2' | 'USER_3';

export interface UserSet {
  /** Human-readable name shown in Playwright reporter */
  name: string;
  /** Account roles this set requires (order matters for multi-user: first is "primary") */
  accounts: AccountRole[];
  /** Suite file matched by the Playwright project's testMatch */
  testSuite: string;
}

/** Separator between set name and environment in project names (e.g. "SET_1 - PROD"). */
const ENV_SEPARATOR = ' - ';

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

// ---------------------------------------------------------------------------
// User sets — single source of truth for account-to-suite mapping.
// Keyed by Playwright project name (testInfo.project.name).
// ---------------------------------------------------------------------------

export const USER_SETS: Record<string, UserSet> = {
  // Single-user registration tests (parallel, ~4min each)
  SET_1: {
    name: 'SET_1',
    accounts: ['USER_1'],
    testSuite: 'set-1.spec.ts',
  },
  SET_2: {
    name: 'SET_2',
    accounts: ['USER_2'],
    testSuite: 'set-2.spec.ts',
  },
  SET_3: {
    name: 'SET_3',
    accounts: ['USER_3'],
    testSuite: 'set-3.spec.ts',
  },

  // 2-user tests (call flows, REG-009)
  // SET_2USER: {
  //   name: 'SET_2USER',
  //   accounts: ['USER_1', 'USER_2'],
  //   testSuite: 'set-2user.spec.ts',
  // },

  // 3-user tests (transfer flows)
  // SET_3USER: {
  //   name: 'SET_3USER',
  //   accounts: ['USER_1', 'USER_2', 'USER_3'],
  //   testSuite: 'set-3user.spec.ts',
  // },
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
