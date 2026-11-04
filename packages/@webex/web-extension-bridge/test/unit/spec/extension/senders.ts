import {assert} from '@webex/test-helper-chai';

import {
  isFromContentScript,
  isFromExtensionPage,
  isOriginAllowed,
  isOwnExtension,
} from '../../../../src/extension/senders';
import type {ChromeLike, ChromeSender} from '../../../../src/extension/platform';

const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';
const chromeApi = {runtime: {id: EXTENSION_ID}} as ChromeLike;

describe('extension/senders', () => {
  const contentScript: ChromeSender = {
    id: EXTENSION_ID,
    origin: 'https://app.example.com',
    tab: {id: 7, url: 'https://app.example.com/'},
  };
  const extensionPage: ChromeSender = {id: EXTENSION_ID};

  describe('the sender-verification matrix', () => {
    const cases: {
      name: string;
      sender: ChromeSender | undefined;
      own: boolean;
      page: boolean;
      content: boolean;
    }[] = [
      {name: 'our content script', sender: contentScript, own: true, page: false, content: true},
      {name: 'our extension page', sender: extensionPage, own: true, page: true, content: false},
      {
        name: 'another extension',
        sender: {id: 'a-different-extension', tab: {id: 7}},
        own: false,
        page: false,
        content: false,
      },
      {
        name: 'a sender claiming a tab but no id',
        sender: {tab: {id: 7}},
        own: false,
        page: false,
        content: false,
      },
      {name: 'a sender with no id', sender: {}, own: false, page: false, content: false},
      {name: 'no sender at all', sender: undefined, own: false, page: false, content: false},
      {
        name: 'a tab with no id, which cannot be addressed',
        sender: {id: EXTENSION_ID, tab: {}},
        own: true,
        page: false,
        content: false,
      },
      {
        name: 'a non-numeric tab id',
        sender: {id: EXTENSION_ID, tab: {id: '7' as never}},
        own: true,
        page: false,
        content: false,
      },
    ];

    cases.forEach(({name, sender, own, page, content}) => {
      it(`classifies ${name}`, () => {
        assert.equal(isOwnExtension(chromeApi, sender), own);
        assert.equal(isFromExtensionPage(chromeApi, sender), page);
        assert.equal(isFromContentScript(chromeApi, sender), content);
      });
    });

    it('never classifies one sender as both a page and a content script', () => {
      cases.forEach(({sender}) => {
        assert.isFalse(
          isFromExtensionPage(chromeApi, sender) && isFromContentScript(chromeApi, sender)
        );
      });
    });
  });

  describe('isOriginAllowed', () => {
    it('refuses a sender that reports no origin', () => {
      // There is no "defer to the manifest" mode any more: the background bridge
      // refuses to construct without an allow-list, so an unknown origin is simply
      // not an allowed one.
      const allowed = new Set(['https://app.example.com']);

      assert.isFalse(isOriginAllowed(allowed, undefined));
      assert.isFalse(isOriginAllowed(allowed, ''));
    });

    it('enforces an exact match when configured', () => {
      const allowed = new Set(['https://app.example.com']);

      assert.isTrue(isOriginAllowed(allowed, 'https://app.example.com'));
      assert.isFalse(isOriginAllowed(allowed, 'https://evil.example.com'));
      assert.isFalse(isOriginAllowed(allowed, 'https://app.example.com.evil.com'));
      assert.isFalse(isOriginAllowed(allowed, 'http://app.example.com'));
      assert.isFalse(isOriginAllowed(allowed, undefined));
    });
  });
});
