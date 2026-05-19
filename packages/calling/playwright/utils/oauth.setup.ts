import {test as setup} from '@playwright/test';
import {ENV_PATH} from '../constants';
import {
  USER_SETS,
  REQUIRED_OAUTH_ROLES,
  AccountRole,
  baseProjectName,
  tokenEnvVar,
} from '../test-data';

type PlaywrightProject = {
  name: string;
  dependencies?: string[];
};

const getCliProjectFilters = (): string[] => {
  const filters: string[] = [];

  for (let i = 0; i < process.argv.length; i += 1) {
    const arg = process.argv[i];

    if (arg === '--project' || arg === '-p') {
      const value = process.argv[i + 1];

      if (value) {
        filters.push(value);
      }
    } else if (arg.startsWith('--project=')) {
      filters.push(arg.slice('--project='.length));
    }
  }

  return filters;
};

const projectMatchesFilter = (projectName: string, filter: string): boolean =>
  projectName === filter || baseProjectName(projectName) === baseProjectName(filter);

const collectProjectWithDependencies = (
  projectName: string,
  projectsByName: Map<string, PlaywrightProject>,
  projectNames: Set<string>
): void => {
  if (projectNames.has(projectName)) {
    return;
  }

  projectNames.add(projectName);

  const project = projectsByName.get(projectName);

  project?.dependencies?.forEach((dependencyName) =>
    collectProjectWithDependencies(dependencyName, projectsByName, projectNames)
  );
};

const getOAuthRolesForRun = (
  isInt: boolean,
  projects: readonly PlaywrightProject[]
): AccountRole[] => {
  const projectEnvSuffix = isInt ? ' - INT' : ' - PROD';
  const projectsByName = new Map(projects.map((project) => [project.name, project]));
  const selectedProjectNames = new Set<string>();
  const cliProjectFilters = getCliProjectFilters();

  if (cliProjectFilters.length > 0) {
    cliProjectFilters.forEach((filter) => {
      projects
        .filter((project) => projectMatchesFilter(project.name, filter))
        .forEach((project) =>
          collectProjectWithDependencies(project.name, projectsByName, selectedProjectNames)
        );
    });
  } else {
    projects
      .filter(
        (project) => project.name.endsWith(projectEnvSuffix) && !project.name.startsWith('OAuth')
      )
      .forEach((project) =>
        collectProjectWithDependencies(project.name, projectsByName, selectedProjectNames)
      );
  }

  const roles = new Set<AccountRole>();

  selectedProjectNames.forEach((projectName) => {
    if (!projectName.endsWith(projectEnvSuffix)) {
      return;
    }

    USER_SETS[baseProjectName(projectName)]?.accounts.forEach((role) => roles.add(role));
  });

  return roles.size > 0 ? Array.from(roles) : REQUIRED_OAUTH_ROLES;
};

const validateEnvAccessTokens = (roles: AccountRole[], isInt: boolean): void => {
  const missingTokens = roles
    .map((role) => tokenEnvVar(role, isInt))
    .filter((envVar) => !process.env[envVar]);

  if (missingTokens.length === 0) {
    return;
  }

  throw new Error(
    `Missing access token(s) in ${ENV_PATH}: ${missingTokens.join(', ')}. ` +
      'Add these values to .env before running e2e tests. ' +
      'OAuth setup now uses .env tokens and does not log in to the developer portal.'
  );
};

/* eslint-disable no-empty-pattern */
setup('OAuth', ({}, testInfo) => {
  const isInt = (testInfo.project.use as any).testEnv === 'int';
  const oauthRoles = getOAuthRolesForRun(isInt, testInfo.config.projects);

  validateEnvAccessTokens(oauthRoles, isInt);
});
/* eslint-enable no-empty-pattern */
