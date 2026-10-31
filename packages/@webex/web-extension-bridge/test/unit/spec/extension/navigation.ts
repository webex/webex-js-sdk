import {assert} from '@webex/test-helper-chai';

import {hasUrlChange, isLoadingNewDocument, originOf} from '../../../../src/extension/navigation';
import type {ChromeTabChangeInfo} from '../../../../src/extension/platform';

describe('extension/navigation', () => {
  describe('the tab-update matrix', () => {
    const cases: {
      name: string;
      changeInfo: ChromeTabChangeInfo;
      loading: boolean;
      url: boolean;
    }[] = [
      {name: 'a load beginning', changeInfo: {status: 'loading'}, loading: true, url: false},
      {
        name: 'a load beginning with its destination',
        changeInfo: {status: 'loading', url: 'https://app.example.com/other.html'},
        loading: true,
        url: true,
      },
      {
        name: 'a same-document route change',
        changeInfo: {url: 'https://app.example.com/meetings'},
        loading: false,
        url: true,
      },
      {name: 'a load completing', changeInfo: {status: 'complete'}, loading: false, url: false},
      {
        name: 'a load completing with a url',
        changeInfo: {status: 'complete', url: 'https://app.example.com/other.html'},
        loading: false,
        url: true,
      },
      {name: 'an unrelated change such as a title', changeInfo: {}, loading: false, url: false},
    ];

    cases.forEach(({name, changeInfo, loading, url}) => {
      it(`classifies ${name}`, () => {
        assert.equal(isLoadingNewDocument(changeInfo), loading);
        assert.equal(hasUrlChange(changeInfo), url);
      });
    });

    it('does not treat a non-string url as a url change', () => {
      assert.isFalse(hasUrlChange({url: 7 as never}));
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
