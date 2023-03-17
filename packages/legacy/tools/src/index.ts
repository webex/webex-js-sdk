/**
 * Library that provides tooling for legacy packages.
 *
 * @packageDocumentation
 */

import { build } from './commands';
import { Package, PackageFile } from './models';

export type {
  BuildOptions,
} from './commands';

export type {
  PackageBuildConfig,
  PackageData,
  PackageFileConfig,
} from './models';

export {
  build,
  Package,
  PackageFile,
};
