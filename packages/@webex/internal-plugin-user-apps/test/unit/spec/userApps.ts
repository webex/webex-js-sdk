import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

import UserApps, {
  USER_APP_ITEM_EVENT,
  USER_APP_METADATA_EVENT,
  USER_APPS_SECTIONS_CHANGED,
  USER_APPS_SYNC_ERROR,
} from '@webex/internal-plugin-user-apps';
import config from '@webex/internal-plugin-user-apps/src/config';

const CONVERSATION_URL =
  'https://conversation.example/conversation/api/v1/conversations/00000000-0000-0000-0000-000000000001';

const createAppsData = ({withMetadata = true} = {}) => ({
  items: {
    static: [],
    dynamicTop: [
      {
        'app-name': 'sections',
        ...(withMetadata
          ? {
              metadata: {
                'default-encryption-key': 'kms://default-key',
                'kms-message': 'wrapped-kms-message',
                clientSpecificData: {
                  sortedSections: ['FAVORITES', 'section-1', 'OTHER'],
                  Default_Sections_Settings: [],
                },
              },
            }
          : {}),
        items: [
          {
            id: 'section-1',
            content: 'ciphertext',
            'encryption-key': 'kms://default-key',
            'list-app-name': 'sections_section-1',
          },
        ],
      },
    ],
    dynamicDerived: [
      {
        'app-name': 'sections_section-1',
        'app-type': 'sections',
        items: [{id: 'membership-1', 'conversation-url': CONVERSATION_URL}],
      },
    ],
  },
});

describe('plugin-user-apps', () => {
  let webex;
  let mercuryCallbacks;

  beforeEach(() => {
    webex = new MockWebex({canAuthorize: true, children: {userApps: UserApps}});
    webex.config.userapps = config.userapps;
    mercuryCallbacks = {};
    webex.internal.mercury = {
      connect: sinon.stub().resolves(),
      on: sinon.stub().callsFake((event, callback) => {
        mercuryCallbacks[event] = callback;
      }),
      off: sinon.stub(),
    };
    webex.internal.services = {
      waitForCatalog: sinon.stub().resolves(),
      getServiceFromUrl: sinon.stub().callsFake((url) => ({
        name: url.includes('conversation.example') ? 'conversation' : 'userApps',
      })),
    };
    webex.internal.device = {userId: 'user-1'};
    webex.internal.encryption = {
      decryptText: sinon.stub().resolves('Project Alpha'),
      encryptText: sinon.stub().resolves('encrypted-title'),
      kms: {
        createUnboundKeys: sinon.stub().resolves([{uri: 'kms://new-key'}]),
        prepareRequest: sinon.stub().resolves({wrapped: 'wrapped-kms-message'}),
      },
    };
    webex.request.resetHistory();
  });

  afterEach(async () => {
    await webex.internal.userApps.unregister();
    sinon.restore();
  });

  const stubInitialSync = (appsData = createAppsData()) => {
    webex.request.onFirstCall().resolves({body: appsData});
    webex.request.onSecondCall().resolves({
      body: {items: []},
      headers: {'x-cisco-endDate': '200'},
    });
  };

  it('is inert until explicitly registered', () => {
    assert.notCalled(webex.request);
    assert.notCalled(webex.internal.mercury.connect);
  });

  it('registers listeners before one full sync and returns an atomic snapshot', async () => {
    stubInitialSync();

    const snapshot = await webex.internal.userApps.register();

    assert.calledOnce(webex.internal.mercury.connect);
    assert.calledWith(webex.internal.mercury.on, USER_APP_ITEM_EVENT);
    assert.calledWith(webex.internal.mercury.on, USER_APP_METADATA_EVENT);
    assert.calledTwice(webex.request);
    assert.calledWithExactly(webex.request.firstCall, {
      service: 'userApps',
      resource: '/',
      method: 'GET',
    });
    assert.calledWithExactly(webex.request.secondCall, {
      service: 'userApps',
      resource: '/catchup',
      method: 'GET',
      qs: {sinceDate: sinon.match.number},
    });
    assert.equal(snapshot.highWaterMark, 200);
    assert.equal(snapshot.sections[1].title, 'Project Alpha');
    assert.equal(snapshot.membershipsByConversationUrl[CONVERSATION_URL].sectionId, 'section-1');
  });

  it('coalesces concurrent registrations', async () => {
    stubInitialSync();

    const first = webex.internal.userApps.register();
    const second = webex.internal.userApps.register();
    const [firstSnapshot, secondSnapshot] = await Promise.all([first, second]);

    assert.strictEqual(firstSnapshot, secondSnapshot);
    assert.calledOnce(webex.internal.mercury.connect);
    assert.callCount(webex.internal.mercury.on, 2);
    assert.calledTwice(webex.request);
  });

  it('cancels registration before listeners or synchronization start', async () => {
    let resolveConnect;

    webex.internal.mercury.connect.returns(
      new Promise((resolve) => {
        resolveConnect = resolve;
      })
    );
    const registration = webex.internal.userApps.register();

    await webex.internal.userApps.unregister();
    resolveConnect();
    const snapshot = await registration;

    assert.deepEqual(snapshot.sectionOrder, ['FAVORITES', 'OTHER']);
    assert.notCalled(webex.internal.mercury.on);
    assert.notCalled(webex.request);
    assert.isFalse(webex.internal.userApps.registered);
  });

  it('shares concurrent sync work', async () => {
    let resolveFullSync;

    webex.request.onFirstCall().returns(
      new Promise((resolve) => {
        resolveFullSync = resolve;
      })
    );
    webex.request.onSecondCall().resolves({
      body: {items: []},
      headers: {'x-cisco-endDate': '200'},
    });

    const first = webex.internal.userApps.sync({forceFull: true});
    const second = webex.internal.userApps.sync({forceFull: true});

    resolveFullSync({body: createAppsData()});
    await Promise.all([first, second]);
    assert.calledTwice(webex.request);
  });

  it('loads only advertised app pagination', async () => {
    const appsData = createAppsData();

    appsData.items.dynamicDerived[0].next =
      'https://user-apps.example/user/api/v1/apps/sections_section-1?cursor=page-2';
    webex.request.onCall(0).resolves({body: appsData});
    webex.request.onCall(1).resolves({
      body: {
        items: [
          {
            id: 'membership-2',
            'conversation-url':
              'https://conversation.example/conversation/api/v1/conversations/00000000-0000-0000-0000-000000000002',
          },
        ],
      },
    });
    webex.request.onCall(2).resolves({
      body: {items: []},
      headers: {'x-cisco-endDate': '200'},
    });

    const snapshot = await webex.internal.userApps.sync({forceFull: true});

    assert.calledWithExactly(webex.request.getCall(1), {
      service: 'userApps',
      resource: '/sections_section-1',
      method: 'GET',
      qs: {cursor: 'page-2'},
    });
    assert.calledWith(
      webex.internal.services.getServiceFromUrl,
      'https://user-apps.example/user/api/v1/apps/sections_section-1?cursor=page-2'
    );
    assert.equal(Object.keys(snapshot.membershipsByConversationUrl).length, 2);
  });

  it('does not paginate or rewrite unrelated dynamic apps', async () => {
    const appsData = createAppsData();

    appsData.items.dynamicDerived.push({
      'app-name': 'another-app',
      'app-type': 'another-type',
      items: [{id: 'unrelated-item', value: 'unchanged'}],
      next: 'https://user-apps.example/user/api/v1/apps/another-app?cursor=page-2',
    } as any);
    stubInitialSync(appsData);

    await webex.internal.userApps.register();

    assert.calledTwice(webex.request);
    assert.deepEqual(appsData.items.dynamicDerived[1].items, [
      {id: 'unrelated-item', value: 'unchanged'},
    ]);
  });

  it('rejects a foreign pagination continuation host', async () => {
    const invalidAppsData = createAppsData();

    invalidAppsData.items.dynamicDerived[0].next =
      'https://evil.example/user/api/v1/apps/sections_section-1?cursor=page-2';
    webex.internal.services.getServiceFromUrl = sinon
      .stub()
      .callsFake((url) => ({name: url.includes('user-apps.example') ? 'userApps' : 'unknown'}));
    webex.request.resolves({body: invalidAppsData});

    let rejectedError: any;

    try {
      await webex.internal.userApps.sync({forceFull: true});
    } catch (error) {
      rejectedError = error;
    }

    assert.match(rejectedError.cause.message, /unrecognized host/);
    assert.calledOnce(webex.request);
  });

  it('does not cache a failed sync promise', async () => {
    webex.request.onCall(0).rejects({statusCode: 503});
    webex.request.onCall(1).resolves({body: createAppsData()});
    webex.request.onCall(2).resolves({
      body: {items: []},
      headers: {'x-cisco-endDate': '200'},
    });

    await assert.isRejected(webex.internal.userApps.sync({forceFull: true}), /synchronization failed/);
    const snapshot = await webex.internal.userApps.sync({forceFull: true});

    assert.equal(snapshot.highWaterMark, 200);
    assert.callCount(webex.request, 3);
  });

  [400, 413].forEach((statusCode) => {
    it(`performs one full-sync recovery after catch-up ${statusCode}`, async () => {
      webex.request.onCall(0).resolves({body: createAppsData()});
      webex.request.onCall(1).rejects({statusCode});
      webex.request.onCall(2).resolves({body: createAppsData()});
      webex.request.onCall(3).resolves({
        body: {items: []},
        headers: {'x-cisco-endDate': '300'},
      });

      const snapshot = await webex.internal.userApps.sync({forceFull: true});

      assert.callCount(webex.request, 4);
      assert.equal(snapshot.highWaterMark, 300);
    });
  });

  it('queues a section event received during hydration', async () => {
    let resolveFullSync;

    webex.request.onFirstCall().returns(
      new Promise((resolve) => {
        resolveFullSync = resolve;
      })
    );
    webex.request.onSecondCall().resolves({
      body: {items: []},
      headers: {'x-cisco-endDate': '200'},
    });

    const registration = webex.internal.userApps.register();

    await Promise.resolve();

    mercuryCallbacks[USER_APP_ITEM_EVENT]({
      data: {
        appName: 'sections_section-1',
        action: 'create',
        appData: {
          id: 'membership-2',
          'conversation-url':
            'https://conversation.example/conversation/api/v1/conversations/00000000-0000-0000-0000-000000000002',
        },
      },
    });
    resolveFullSync({body: createAppsData()});

    const snapshot = await registration;

    assert.equal(Object.keys(snapshot.membershipsByConversationUrl).length, 2);
  });

  it('applies a section event received while catch-up is publishing', async () => {
    let resolveCatchup;

    webex.request.onFirstCall().resolves({body: createAppsData()});
    webex.request.onSecondCall().returns(
      new Promise((resolve) => {
        resolveCatchup = resolve;
      })
    );

    const registration = webex.internal.userApps.register();

    while (webex.request.callCount < 2) {
      await Promise.resolve();
    }
    mercuryCallbacks[USER_APP_ITEM_EVENT]({
      data: {
        appName: 'sections',
        action: 'create',
        appData: {
          id: 'section-2',
          content: 'ciphertext-2',
          'encryption-key': 'kms://default-key',
          'list-app-name': 'sections_section-2',
        },
      },
    });
    resolveCatchup({body: {items: []}, headers: {'x-cisco-endDate': '200'}});

    const snapshot = await registration;

    assert.isDefined(snapshot.sections.find(({id}) => id === 'section-2'));
  });

  it('ignores unrelated user-app events', async () => {
    stubInitialSync();
    await webex.internal.userApps.register();
    const changed = sinon.spy();

    webex.internal.userApps.on(USER_APPS_SECTIONS_CHANGED, changed);
    mercuryCallbacks[USER_APP_ITEM_EVENT]({
      data: {appName: 'flags', action: 'create', appData: {id: 'flag-1'}},
    });

    assert.notCalled(changed);
  });

  it('applies metadata events without refetching', async () => {
    stubInitialSync();
    await webex.internal.userApps.register();
    let resolveChanged: (args: any[]) => void;
    const changedEvent = new Promise<any[]>((resolve) => {
      resolveChanged = resolve;
    });
    const changed = sinon.spy((...args) => resolveChanged(args));

    webex.internal.userApps.on(USER_APPS_SECTIONS_CHANGED, changed);
    mercuryCallbacks[USER_APP_METADATA_EVENT]({
      data: {
        appName: 'sections',
        action: 'update',
        appData: {
          'default-encryption-key': 'kms://default-key',
          clientSpecificData: {sortedSections: ['FAVORITES', 'OTHER', 'section-1']},
        },
      },
    });
    const eventArgs = await changedEvent;
    const event = eventArgs.find((arg) => arg?.source === 'mercury');

    assert.calledTwice(webex.request);
    assert.equal(event.source, 'mercury');
  });

  it('publishes Mercury changes in arrival order', async () => {
    stubInitialSync();
    await webex.internal.userApps.register();
    let resolveFirstDecryption;
    let resolveFirstDecryptionStarted;
    const firstDecryptionStarted = new Promise<void>((resolve) => {
      resolveFirstDecryptionStarted = resolve;
    });
    let changedCount = 0;
    const changed = new Promise<void>((resolve) => {
      webex.internal.userApps.on(USER_APPS_SECTIONS_CHANGED, ({source}) => {
        if (source === 'mercury' && ++changedCount === 2) {
          resolve();
        }
      });
    });

    webex.internal.encryption.decryptText.resetBehavior();
    webex.internal.encryption.decryptText.resetHistory();
    webex.internal.encryption.decryptText.onFirstCall().callsFake(
      () =>
        new Promise((resolve) => {
          resolveFirstDecryption = resolve;
          resolveFirstDecryptionStarted();
        })
    );
    webex.internal.encryption.decryptText.onSecondCall().resolves('Project Alpha');

    mercuryCallbacks[USER_APP_METADATA_EVENT]({
      data: {
        appName: 'sections',
        action: 'update',
        appData: {
          'default-encryption-key': 'kms://default-key',
          clientSpecificData: {sortedSections: ['OTHER', 'FAVORITES', 'section-1']},
        },
      },
    });
    mercuryCallbacks[USER_APP_METADATA_EVENT]({
      data: {
        appName: 'sections',
        action: 'update',
        appData: {
          'default-encryption-key': 'kms://default-key',
          clientSpecificData: {sortedSections: ['section-1', 'FAVORITES', 'OTHER']},
        },
      },
    });

    await firstDecryptionStarted;
    assert.calledOnce(webex.internal.encryption.decryptText);

    resolveFirstDecryption('Project Alpha');
    await changed;

    assert.deepEqual(webex.internal.userApps._snapshot.sectionOrder, [
      'section-1',
      'FAVORITES',
      'OTHER',
    ]);
  });

  it('discards an in-flight Mercury publication after unregistering', async () => {
    stubInitialSync();
    await webex.internal.userApps.register();
    let resolveDecryption;
    let resolveDecryptionStarted;
    const decryptionStarted = new Promise<void>((resolve) => {
      resolveDecryptionStarted = resolve;
    });
    const changed = sinon.spy();

    webex.internal.encryption.decryptText.resetBehavior();
    webex.internal.encryption.decryptText.callsFake(
      () =>
        new Promise((resolve) => {
          resolveDecryption = resolve;
          resolveDecryptionStarted();
        })
    );
    webex.internal.userApps.on(USER_APPS_SECTIONS_CHANGED, changed);
    mercuryCallbacks[USER_APP_METADATA_EVENT]({
      data: {
        appName: 'sections',
        action: 'update',
        appData: {
          'default-encryption-key': 'kms://default-key',
          clientSpecificData: {sortedSections: ['OTHER', 'section-1', 'FAVORITES']},
        },
      },
    });

    await decryptionStarted;
    await webex.internal.userApps.unregister();
    resolveDecryption('Project Alpha');
    await webex.internal.userApps._changePromise;

    assert.notCalled(changed);
  });

  it('keeps a corrupt section title unavailable without exposing ciphertext', async () => {
    stubInitialSync();
    webex.internal.encryption.decryptText.rejects(new Error('decrypt failed'));
    const syncError = sinon.spy();

    webex.internal.userApps.on(USER_APPS_SYNC_ERROR, syncError);
    const snapshot = await webex.internal.userApps.register();

    assert.equal(snapshot.sections[1].title, null);
    assert.equal(snapshot.sections[1].titleState, 'unavailable');
    assert.notInclude(JSON.stringify(snapshot), 'ciphertext');
    assert.called(syncError);
  });

  it('removes only its own listeners and timer when unregistered', async () => {
    stubInitialSync();
    await webex.internal.userApps.register();

    await webex.internal.userApps.unregister();

    assert.calledWith(webex.internal.mercury.off, USER_APP_ITEM_EVENT);
    assert.calledWith(webex.internal.mercury.off, USER_APP_METADATA_EVENT);
    assert.equal(webex.internal.userApps.registered, false);
  });

  it('does not schedule catch-up after unregistering during initial sync', async () => {
    let resolveFullSync;
    const setIntervalSpy = sinon.spy(global, 'setInterval');

    webex.request.onFirstCall().returns(
      new Promise((resolve) => {
        resolveFullSync = resolve;
      })
    );
    webex.request.onSecondCall().resolves({
      body: {items: []},
      headers: {'x-cisco-endDate': '200'},
    });

    const registration = webex.internal.userApps.register();
    const changed = sinon.spy();

    webex.internal.userApps.on(USER_APPS_SECTIONS_CHANGED, changed);

    while (webex.request.callCount < 1) {
      await Promise.resolve();
    }
    await webex.internal.userApps.unregister();
    resolveFullSync({body: createAppsData()});
    await registration;

    assert.notCalled(setIntervalSpy);
    assert.notCalled(changed);
    assert.calledOnce(webex.request);
    assert.equal(webex.internal.userApps.registered, false);
  });

  it('initializes metadata lazily and encrypts a new section title', async () => {
    stubInitialSync(createAppsData({withMetadata: false}));
    webex.request.onCall(2).resolves({
      body: {
        'default-encryption-key': 'kms://new-key',
        'kms-message': 'wrapped-kms-message',
        clientSpecificData: {sortedSections: ['FAVORITES', 'OTHER']},
      },
    });
    webex.request.onCall(3).resolves({
      body: {
        id: 'section-2',
        content: 'encrypted-title',
        'encryption-key': 'kms://new-key',
        'list-app-name': 'sections_section-2',
      },
    });
    webex.request.onCall(4).resolves({
      body: {
        'default-encryption-key': 'kms://new-key',
        clientSpecificData: {
          sortedSections: ['FAVORITES', 'section-1', 'section-2', 'OTHER'],
        },
      },
    });
    await webex.internal.userApps.register();

    const section = await webex.internal.userApps.createSection({title: ' Project Beta '});

    assert.calledOnceWithExactly(webex.internal.encryption.kms.createUnboundKeys, {count: 1});
    assert.calledOnceWithExactly(webex.internal.encryption.kms.prepareRequest, {
      method: 'create',
      uri: '/resources',
      userIds: ['user-1'],
      keyUris: ['kms://new-key'],
    });
    assert.calledOnceWithExactly(
      webex.internal.encryption.encryptText,
      'kms://new-key',
      'Project Beta'
    );
    assert.calledWithMatch(webex.request.getCall(2), {
      service: 'userApps',
      resource: '/sections',
      method: 'PUT',
      body: {'kms-message': 'wrapped-kms-message', 'encryption-key': 'kms://new-key'},
    });
    assert.calledWithExactly(webex.request.getCall(4), {
      service: 'userApps',
      resource: '/sections',
      method: 'PUT',
      body: {
        clientSpecificData: {
          sortedSections: ['FAVORITES', 'section-1', 'section-2', 'OTHER'],
        },
      },
    });
    assert.equal(section.id, 'section-2');
  });

  it('moves a validated conversation with one target POST and updates membership', async () => {
    stubInitialSync();
    webex.request.onCall(2).resolves({
      body: {id: 'membership-2', 'conversation-url': CONVERSATION_URL},
    });
    await webex.internal.userApps.register();

    const membership = await webex.internal.userApps.moveConversationToSection({
      sectionId: 'section-1',
      conversationUrl: CONVERSATION_URL,
    });

    assert.calledWithExactly(webex.request.getCall(2), {
      service: 'userApps',
      resource: '/sections_section-1',
      method: 'POST',
      body: {'conversation-url': CONVERSATION_URL},
    });
    assert.equal(membership.id, 'membership-2');
  });

  it('persists a complete section order without service metadata fields', async () => {
    const appsData = createAppsData();

    appsData.items.dynamicTop[0].metadata.clientSpecificData.Default_Sections_Settings = [
      {section_name: 'FAVORITES', settings: []},
      {section_name: 'OTHER', settings: []},
    ];
    stubInitialSync(appsData);
    webex.request.onCall(2).resolves({
      body: {
        metadata: {
          ...appsData.items.dynamicTop[0].metadata,
          clientSpecificData: {
            ...appsData.items.dynamicTop[0].metadata.clientSpecificData,
            sortedSections: ['OTHER', 'section-1', 'FAVORITES'],
          },
        },
      },
    });
    await webex.internal.userApps.register();

    const snapshot = await webex.internal.userApps.reorderSections({
      sectionIds: ['OTHER', 'section-1', 'FAVORITES'],
    });

    assert.calledWithExactly(webex.request.getCall(2), {
      service: 'userApps',
      resource: '/sections',
      method: 'PUT',
      body: {
        clientSpecificData: {
          sortedSections: ['OTHER', 'section-1', 'FAVORITES'],
          Default_Sections_Settings: [
            {section_name: 'FAVORITES', settings: []},
            {section_name: 'OTHER', settings: []},
          ],
        },
      },
    });
    assert.deepEqual(snapshot.sectionOrder, ['OTHER', 'section-1', 'FAVORITES']);
  });

  it('serializes consecutive section order writes', async () => {
    stubInitialSync();
    let resolveFirstOrder;

    webex.request.onCall(2).returns(
      new Promise((resolve) => {
        resolveFirstOrder = resolve;
      })
    );
    webex.request.onCall(3).resolves({
      body: {
        metadata: {
          ...createAppsData().items.dynamicTop[0].metadata,
          clientSpecificData: {
            sortedSections: ['FAVORITES', 'OTHER', 'section-1'],
            Default_Sections_Settings: [],
          },
        },
      },
    });
    await webex.internal.userApps.register();

    const first = webex.internal.userApps.reorderSections({
      sectionIds: ['OTHER', 'section-1', 'FAVORITES'],
    });
    const second = webex.internal.userApps.reorderSections({
      sectionIds: ['FAVORITES', 'OTHER', 'section-1'],
    });

    while (webex.request.callCount < 3) {
      await Promise.resolve();
    }
    assert.equal(webex.request.callCount, 3);
    resolveFirstOrder({
      body: {
        metadata: {
          ...createAppsData().items.dynamicTop[0].metadata,
          clientSpecificData: {
            sortedSections: ['OTHER', 'section-1', 'FAVORITES'],
            Default_Sections_Settings: [],
          },
        },
      },
    });
    await Promise.all([first, second]);

    assert.calledWithMatch(webex.request.getCall(2), {
      body: {clientSpecificData: {sortedSections: ['OTHER', 'section-1', 'FAVORITES']}},
    });
    assert.calledWithMatch(webex.request.getCall(3), {
      body: {clientSpecificData: {sortedSections: ['FAVORITES', 'OTHER', 'section-1']}},
    });
  });

  it('rejects an incomplete section order before network access', async () => {
    stubInitialSync();
    await webex.internal.userApps.register();

    await assert.isRejected(
      webex.internal.userApps.reorderSections({sectionIds: ['section-1']}),
      /every section exactly once/
    );
    assert.calledTwice(webex.request);
  });

  it('renames, detaches, and deletes through confirmed service operations', async () => {
    stubInitialSync();
    webex.request.onCall(2).resolves({
      body: {
        id: 'section-1',
        content: 'encrypted-title',
        'encryption-key': 'kms://default-key',
        'list-app-name': 'sections_section-1',
      },
    });
    webex.request.onCall(3).resolves({body: {}});
    webex.request.onCall(4).resolves({body: {}});
    webex.request.onCall(5).resolves({body: createAppsData().items.dynamicTop[0].metadata});
    await webex.internal.userApps.register();

    const renamed = await webex.internal.userApps.renameSection({
      sectionId: 'section-1',
      title: 'Renamed',
    });

    assert.equal(renamed.title, 'Project Alpha');
    assert.calledWithMatch(webex.request.getCall(2), {
      resource: '/sections/section-1',
      method: 'PUT',
    });

    await webex.internal.userApps.removeConversationFromSection({
      sectionId: 'section-1',
      conversationUrl: CONVERSATION_URL,
    });
    assert.calledWithMatch(webex.request.getCall(3), {
      resource: '/sections_section-1/membership-1',
      method: 'DELETE',
    });

    await webex.internal.userApps.deleteSection({sectionId: 'section-1'});
    assert.calledWithMatch(webex.request.getCall(4), {
      resource: '/sections/section-1',
      method: 'DELETE',
    });
    const snapshot = await webex.internal.userApps.getSections();

    assert.isUndefined(snapshot.sections.find(({id}) => id === 'section-1'));
    assert.isUndefined(snapshot.membershipsByConversationUrl[CONVERSATION_URL]);
  });

  it('returns a confirmed create when only the secondary order update fails', async () => {
    stubInitialSync();
    webex.request.onCall(2).resolves({
      body: {
        id: 'section-2',
        content: 'encrypted-title',
        'encryption-key': 'kms://default-key',
        'list-app-name': 'sections_section-2',
      },
    });
    webex.request.onCall(3).rejects(Object.assign(new Error('unavailable'), {statusCode: 503}));

    await webex.internal.userApps.register();
    const section = await webex.internal.userApps.createSection({title: 'Project Beta'});

    assert.equal(section.id, 'section-2');
    assert.callCount(webex.request, 4);
  });

  it('rejects system section mutations before network access', async () => {
    await assert.isRejected(
      webex.internal.userApps.deleteSection({sectionId: 'FAVORITES'}),
      /custom section ID/
    );
    assert.notCalled(webex.request);
  });
});
