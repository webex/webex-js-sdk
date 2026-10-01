/**
 * Library that provides tooling for legacy packages.
 *
 * @packageDocumentation
 */

import { build, runTests } from './commands';
import { Package, PackageFile } from './models';
import {
  Jest, Karma, KmsCaroots, Mocha, startServer,
  stopServer, findWorkspaceRoot, getServerPath,
} from './utils';

export type {
  PackageBuildConfig,
  PackageTestBrowser,
  PackageTestConfig,
  PackageTestRunner,
  PackageData,
  PackageFileConfig,
} from './models';

export {
  build,
  runTests,
  Jest,
  Karma,
  KmsCaroots,
  Mocha,
  Package,
  PackageFile,
  startServer,
  stopServer,
  findWorkspaceRoot,
  getServerPath,
};
