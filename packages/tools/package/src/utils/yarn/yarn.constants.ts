import type { ListConfig, ViewConfig } from './yarn.types';

const COMMANDS = {
  LIST: 'yarn workspaces list',
  VIEW: 'npm view',
};

const LIST_CONFIG: ListConfig = {
  json: true,
  noPrivate: true,
  recursive: true,
  verbose: false,
};

const VIEW_CONFIG: Partial<ViewConfig> = {
  distTags: false,
  json: true,
  version: false,
};

const CONSTANTS = {
  COMMANDS,
  LIST_CONFIG,
  VIEW_CONFIG,
};

export default CONSTANTS;
