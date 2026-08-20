import {assert} from '@webex/test-helper-chai';

import {isAutomatedUser, isAutomatedUserAgent} from '../../../src/automated-user';

describe('automated user detection', () => {
  [
    {userAgent: 'SkypeUriPreview', expected: true},
    {userAgent: 'skypeuripreview', expected: true},
    {userAgent: 'Mozilla/5.0 (compatible; SkypeUriPreview/0.1)', expected: true},
    {userAgent: 'Googlebot/2.1 (+http://www.google.com/bot.html)', expected: true},
    {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
      expected: false,
    },
    {userAgent: undefined, expected: false},
  ].forEach(({userAgent, expected}) => {
    it(`returns ${expected} for ${userAgent || 'an undefined user agent'}`, () => {
      assert.equal(isAutomatedUserAgent(userAgent), expected);
    });
  });

  it('returns the cached classification when navigator changes', () => {
    const cachedResult = isAutomatedUser();
    const originalDescriptor = Object.getOwnPropertyDescriptor(global, 'navigator');

    Object.defineProperty(global, 'navigator', {
      value: cachedResult
        ? {userAgent: 'Mozilla/5.0', webdriver: false}
        : {userAgent: 'SkypeUriPreview', webdriver: true},
      configurable: true,
      writable: true,
    });

    assert.equal(isAutomatedUser(), cachedResult);

    if (originalDescriptor) {
      Object.defineProperty(global, 'navigator', originalDescriptor);
    } else {
      delete (global as any).navigator;
    }
  });
});
