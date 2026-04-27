/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

export function flaky(mochaMethod, envVar) {
  if (!mochaMethod.skip) {
    return mochaMethod;
  }

  const shouldSkip = envVar && envVar !== 'false' && !!envVar;

  return shouldSkip ? mochaMethod.skip : mochaMethod;
}

export function skipInBrowser(mochaMethod) {
  return mochaMethod;
}
