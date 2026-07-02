/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

type MochaMethod = ((...args: any[]) => any) & {
  skip?: (...args: any[]) => any;
};

export function flaky(mochaMethod: MochaMethod, envVar?: string) {
  if (!mochaMethod.skip) {
    return mochaMethod;
  }

  const shouldSkip = envVar && envVar !== 'false' && !!envVar;

  return shouldSkip ? mochaMethod.skip : mochaMethod;
}

export function skipInBrowser(mochaMethod: MochaMethod) {
  return mochaMethod;
}
