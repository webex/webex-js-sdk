import {assert} from '@webex/test-helper-chai';

import {MAX_STORED_URL_LENGTH} from '../../../../src/core/constants';
import {hasUrlChange, isStorableUrl, originOf} from '../../../../src/extension/navigation';
import type {ChromeTabChangeInfo} from '../../../../src/extension/platform';

describe('extension/navigation', () => {
  describe('hasUrlChange', () => {
    /**
     * The shapes Chrome actually emits, measured against a loaded extension. A route
     * change and a followed link are indistinguishable, which is why only the url is
     * read: `status` is recorded here to document that it carries no signal.
     */
    const cases: {name: string; changeInfo: ChromeTabChangeInfo; url: boolean}[] = [
      {
        name: 'a route change (pushState, replaceState, fragment or back)',
        changeInfo: {status: 'loading', url: 'https://app.example.com/meetings'},
        url: true,
      },
      {
        name: 'a followed link to another document, reported identically',
        changeInfo: {status: 'loading', url: 'https://app.example.com/other.html'},
        url: true,
      },
      {name: 'a reload, which reports no url', changeInfo: {status: 'loading'}, url: false},
      {name: 'a load completing', changeInfo: {status: 'complete'}, url: false},
      {name: 'an unrelated change such as a title', changeInfo: {}, url: false},
      {
        name: 'a url arriving without any status',
        changeInfo: {url: 'https://app.example.com/meetings'},
        url: true,
      },
    ];

    cases.forEach(({name, changeInfo, url}) => {
      it(`classifies ${name}`, () => {
        assert.equal(hasUrlChange(changeInfo), url);
      });
    });

    it('does not treat a non-string url as a url change', () => {
      assert.isFalse(hasUrlChange({url: 7 as never}));
    });

    it('still reports an over-long url, so the origin check cannot be skipped', () => {
      const url = `https://app.example.com/${'a'.repeat(MAX_STORED_URL_LENGTH)}`;

      assert.isTrue(hasUrlChange({url}));
      assert.isFalse(isStorableUrl(url));
    });
  });

  describe('isStorableUrl', () => {
    const cases: [string, string, boolean][] = [
      ['an ordinary route', 'https://app.example.com/meetings/42', true],
      ['a url exactly at the ceiling', 'a'.repeat(MAX_STORED_URL_LENGTH), true],
      ['a url one character past it', 'a'.repeat(MAX_STORED_URL_LENGTH + 1), false],
      ['an empty url', '', true],
    ];

    cases.forEach(([name, url, expected]) => {
      it(`accepts or refuses ${name}`, () => {
        assert.equal(isStorableUrl(url), expected);
      });
    });
  });

  describe('originOf', () => {
    const cases: [string, string | undefined][] = [
      ['https://app.example.com/meetings/42', 'https://app.example.com'],
      ['https://app.example.com/index.html?view=grid#/settings', 'https://app.example.com'],
      ['https://app.example.com:8443/app', 'https://app.example.com:8443'],
      ['http://localhost:8000/', 'http://localhost:8000'],
      // Opaque and privileged schemes have no origin that can match a connected
      // document, so they fall through to the caller's comparison as a mismatch.
      ['about:blank', 'null'],
      ['chrome://extensions/', 'null'],
      ['not a url', undefined],
      ['', undefined],
    ];

    cases.forEach(([url, expected]) => {
      it(`reads the origin of '${url}'`, () => {
        assert.equal(originOf(url), expected);
      });
    });
  });
});
