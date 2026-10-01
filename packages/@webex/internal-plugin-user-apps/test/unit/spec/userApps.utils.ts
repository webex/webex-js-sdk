import {assert} from '@webex/test-helper-chai';

import {
  applyChangeToWireData,
  buildSnapshot,
  createEmptyWireData,
  extractCursor,
  extractNextFromLink,
} from '@webex/internal-plugin-user-apps/src/userApps.utils';

describe('userApps utils', () => {
  describe('#extractCursor()', () => {
    it('extracts the cursor from the expected app continuation', () => {
      assert.equal(
        extractCursor(
          'https://user-apps.example/user/api/v1/apps/sections_one?cursor=member-1',
          'sections_one'
        ),
        'member-1'
      );
    });

    it('rejects a continuation for another app', () => {
      assert.throws(
        () =>
          extractCursor(
            'https://user-apps.example/user/api/v1/apps/sections_two?cursor=member-1',
            'sections_one'
          ),
        /Invalid user-app continuation URL/
      );
    });
  });

  it('extracts only the next Link relation', () => {
    assert.equal(
      extractNextFromLink(
        '<https://user-apps.example/previous>; rel="previous", <https://user-apps.example/next>; rel="next"'
      ),
      'https://user-apps.example/next'
    );
  });

  it('creates the sections app when metadata arrives before any section item', () => {
    const data = createEmptyWireData();

    applyChangeToWireData(data, {
      eventType: 'user.app_metadata',
      appName: 'sections',
      action: 'create',
      appData: {
        'default-encryption-key': 'kms://key',
        clientSpecificData: {sortedSections: ['FAVORITES', 'OTHER']},
      },
    });

    assert.deepEqual(data.items?.dynamicTop, [
      {
        'app-name': 'sections',
        items: [],
        metadata: {
          'default-encryption-key': 'kms://key',
          clientSpecificData: {sortedSections: ['FAVORITES', 'OTHER']},
        },
      },
    ]);
  });

  it('preserves encryption metadata when a partial metadata event arrives', () => {
    const data = createEmptyWireData();

    applyChangeToWireData(data, {
      eventType: 'user.app_metadata',
      appName: 'sections',
      action: 'create',
      appData: {
        'default-encryption-key': 'kms://key',
        'kms-message': 'wrapped-key',
        clientSpecificData: {
          sortedSections: ['FAVORITES', 'OTHER'],
          Default_Sections_Settings: [{section_name: 'OTHER', settings: []}],
        },
      },
    });
    applyChangeToWireData(data, {
      eventType: 'user.app_metadata',
      appName: 'sections',
      action: 'update',
      appData: {
        clientSpecificData: {sortedSections: ['OTHER', 'FAVORITES']},
      },
    });

    assert.deepEqual(data.items?.dynamicTop?.[0].metadata, {
      'default-encryption-key': 'kms://key',
      'kms-message': 'wrapped-key',
      clientSpecificData: {
        sortedSections: ['OTHER', 'FAVORITES'],
        Default_Sections_Settings: [{section_name: 'OTHER', settings: []}],
      },
    });
  });

  it('reduces section changes and keeps the first membership for duplicate conversations', () => {
    const data = createEmptyWireData();

    applyChangeToWireData(data, {
      eventType: 'user.app_item',
      appName: 'sections',
      action: 'create',
      appData: {
        id: 'section-1',
        content: 'ciphertext',
        'encryption-key': 'kms://key',
        'list-app-name': 'sections_section-1',
      },
    });
    applyChangeToWireData(data, {
      eventType: 'user.app_item',
      appName: 'sections_section-1',
      action: 'create',
      appData: {
        id: 'membership-1',
        'conversation-url':
          'https://conversation.example/conversation/api/v1/conversations/00000000-0000-0000-0000-000000000001',
      },
    });
    applyChangeToWireData(data, {
      eventType: 'user.app_item',
      appName: 'sections_section-1',
      action: 'create',
      appData: {
        id: 'membership-2',
        'conversation-url':
          'https://conversation.example/conversation/api/v1/conversations/00000000-0000-0000-0000-000000000001',
      },
    });

    const snapshot = buildSnapshot({
      data,
      decryptedTitles: new Map([['section-1', 'Project Alpha']]),
      unavailableSectionIds: new Set(),
      syncedAt: 100,
      highWaterMark: 90,
    });

    assert.deepEqual(snapshot.sectionOrder, ['FAVORITES', 'section-1', 'OTHER']);
    assert.equal(snapshot.sections[1].title, 'Project Alpha');
    assert.deepEqual(snapshot.sections[1].conversationUrls, [
      'https://conversation.example/conversation/api/v1/conversations/00000000-0000-0000-0000-000000000001',
    ]);
    assert.equal(
      snapshot.membershipsByConversationUrl[
        'https://conversation.example/conversation/api/v1/conversations/00000000-0000-0000-0000-000000000001'
      ].id,
      'membership-1'
    );
  });

  it('maps section memberships when Raindrop provides a list URL', () => {
    const data = createEmptyWireData();

    data.items?.dynamicTop?.push({
      'app-name': 'sections',
      items: [
        {
          id: 'section-1',
          content: 'ciphertext',
          'encryption-key': 'kms://key',
          list: 'https://user-apps.example/user/api/v1/apps/sections_section-1',
        },
      ],
    });
    data.items?.dynamicDerived?.push({
      'app-name': 'sections_section-1',
      'app-type': 'sections',
      items: [
        {
          id: 'membership-1',
          'conversation-url':
            'https://conversation.example/conversation/api/v1/conversations/00000000-0000-0000-0000-000000000001',
        },
      ],
    });

    const snapshot = buildSnapshot({
      data,
      decryptedTitles: new Map([['section-1', 'Project Alpha']]),
      unavailableSectionIds: new Set(),
      syncedAt: 100,
      highWaterMark: 90,
    });

    assert.equal(snapshot.sections[1].listAppName, 'sections_section-1');
    assert.equal(
      snapshot.membershipsByConversationUrl[
        'https://conversation.example/conversation/api/v1/conversations/00000000-0000-0000-0000-000000000001'
      ].sectionId,
      'section-1'
    );
  });

  it('preserves the complete native section order', () => {
    const data = createEmptyWireData();

    data.items?.dynamicTop?.push({
      'app-name': 'sections',
      metadata: {
        clientSpecificData: {
          sortedSections: ['section-2', 'OTHER', 'FAVORITES', 'section-1'],
        },
      },
      items: [
        {
          id: 'section-1',
          content: 'ciphertext-1',
          'encryption-key': 'kms://key',
          'list-app-name': 'sections_section-1',
        },
        {
          id: 'section-2',
          content: 'ciphertext-2',
          'encryption-key': 'kms://key',
          'list-app-name': 'sections_section-2',
        },
      ],
    });

    const snapshot = buildSnapshot({
      data,
      decryptedTitles: new Map([
        ['section-1', 'One'],
        ['section-2', 'Two'],
      ]),
      unavailableSectionIds: new Set(),
      syncedAt: 100,
      highWaterMark: 90,
    });

    assert.deepEqual(snapshot.sectionOrder, [
      'section-2',
      'OTHER',
      'FAVORITES',
      'section-1',
    ]);
  });
});
