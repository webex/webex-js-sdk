/* eslint-disable no-underscore-dangle, require-jsdoc */
import {WebexPlugin} from '@webex/webex-core';

import {
  CATCHUP_RESOURCE,
  DEFAULT_SECTION_ORDER,
  FAVORITES_SECTION_ID,
  HIGH_WATER_HEADER,
  OTHER_SECTION_ID,
  RECOVERABLE_CATCHUP_STATUS_CODES,
  SECTIONS_APP,
  USER_APP_ITEM_EVENT,
  USER_APP_METADATA_EVENT,
  USER_APPS_REGISTERED,
  USER_APPS_SECTIONS_CHANGED,
  USER_APPS_SERVICE,
  USER_APPS_SYNC_ERROR,
  USER_APPS_UNREGISTERED,
} from './constants';
import {
  CatchupResetRequiredError,
  UserAppsEncryptionError,
  UserAppsSyncError,
  UserAppsValidationError,
} from './errors';
import type {
  SectionChangeSource,
  SectionMembership,
  SpaceListSection,
  SpaceListSectionsSnapshot,
  SyncOptions,
  UserAppChangeWire,
  UserAppDerivedWire,
  UserAppsCatchupWire,
  UserAppsDataWire,
  UserAppsMetadataWire,
  UserAppSectionWire,
} from './types';
import {
  applyChangeToWireData,
  buildSnapshot,
  createEmptyWireData,
  extractCursor,
  extractNextFromLink,
  getHeader,
  getMetadata,
  getSectionListAppName,
  getSectionsApp,
  getStatusCode,
  isSectionsAppName,
  mergeMetadata,
} from './userApps.utils';

const CONVERSATION_PATH = /\/conversations\/([0-9a-f-]{36})\/?$/i;

const UserApps = WebexPlugin.extend({
  namespace: 'UserApps',
  registered: false,

  initialize(...args) {
    Reflect.apply(WebexPlugin.prototype.initialize, this, args);
    this._appsData = createEmptyWireData();
    this._snapshot = null;
    this._registerPromise = null;
    this._syncPromise = null;
    this._syncGeneration = null;
    this._metadataPromise = null;
    this._metadataWritePromise = Promise.resolve();
    this._changePromise = Promise.resolve();
    this._publicationPromise = Promise.resolve();
    this._lifecycleGeneration = 0;
    this._catchupTimer = null;
    this._queuedChanges = [];
    this._hydrating = false;
    this._catalogReadyPromise = null;
    this._itemEventHandler = (envelope) => this._handleMercuryEnvelope('user.app_item', envelope);
    this._metadataEventHandler = (envelope) =>
      this._handleMercuryEnvelope('user.app_metadata', envelope);
  },

  register(): Promise<SpaceListSectionsSnapshot> {
    if (!this.webex.canAuthorize) {
      return Promise.reject(
        new UserAppsValidationError('SDK cannot authorize user-app synchronization')
      );
    }

    if (this._registerPromise) {
      return this._registerPromise;
    }

    if (this.registered) {
      return this.getSections();
    }

    this._lifecycleGeneration += 1;
    const lifecycleGeneration = this._lifecycleGeneration;
    const registration = (async () => {
      await this.webex.internal.mercury.connect();

      if (!this._isLifecycleCurrent(lifecycleGeneration)) {
        return this._getInactiveSnapshot();
      }

      this._listenForEvents();
      this.registered = true;
      this._hydrating = true;
      this.trigger(USER_APPS_REGISTERED);

      try {
        const snapshot = await this.sync({forceFull: true}, lifecycleGeneration);

        if (this._isLifecycleActive(lifecycleGeneration)) {
          this._scheduleCatchup();
        }

        return snapshot;
      } catch (error) {
        if (this._isLifecycleCurrent(lifecycleGeneration)) {
          await this.unregister();
        }
        throw error;
      }
    })();

    this._registerPromise = registration;
    registration.then(
      () => {
        if (this._registerPromise === registration) {
          this._registerPromise = null;
        }
      },
      () => {
        if (this._registerPromise === registration) {
          this._registerPromise = null;
        }
      }
    );

    return registration;
  },

  async unregister(): Promise<void> {
    const wasRegistered = this.registered;

    this._lifecycleGeneration += 1;
    this._registerPromise = null;
    this._syncPromise = null;
    this._syncGeneration = null;

    this.stopListening(this.webex.internal.mercury, USER_APP_ITEM_EVENT, this._itemEventHandler);
    this.stopListening(
      this.webex.internal.mercury,
      USER_APP_METADATA_EVENT,
      this._metadataEventHandler
    );
    this._clearCatchupTimer();
    this._queuedChanges = [];
    this._hydrating = false;
    this.registered = false;

    if (wasRegistered) {
      this.trigger(USER_APPS_UNREGISTERED);
    }
  },

  async sync(
    options?: SyncOptions,
    lifecycleGeneration?: number
  ): Promise<SpaceListSectionsSnapshot> {
    const syncOptions = options ?? {};

    if (this._syncPromise && this._syncGeneration === lifecycleGeneration) {
      return this._syncPromise;
    }

    const syncPromise = (async () => {
      try {
        if (!syncOptions.forceFull && this._snapshot?.highWaterMark) {
          return await this._catchup(this._snapshot.highWaterMark, true, true, lifecycleGeneration);
        }

        return await this._fullSync(true, lifecycleGeneration);
      } catch (error) {
        if (!this._canCommitLifecycle(lifecycleGeneration)) {
          return this._getInactiveSnapshot();
        }

        const syncError =
          error instanceof UserAppsSyncError
            ? error
            : new UserAppsSyncError('User-app synchronization failed', {
                cause: error,
                statusCode: getStatusCode(error),
              });

        this.trigger(USER_APPS_SYNC_ERROR, syncError);
        throw syncError;
      }
    })();

    this._syncPromise = syncPromise;
    this._syncGeneration = lifecycleGeneration;

    try {
      return await syncPromise;
    } finally {
      if (this._syncPromise === syncPromise) {
        this._syncPromise = null;
        this._syncGeneration = null;
      }
    }
  },

  async getSections(options: {force?: boolean} = {}): Promise<SpaceListSectionsSnapshot> {
    const cacheTtlMs = this.config.cacheTtlMs ?? 300_000;
    const cacheIsFresh =
      this._snapshot && !options.force && this._snapshot.syncedAt + cacheTtlMs > Date.now();

    if (cacheIsFresh) {
      return this._snapshot;
    }

    return this.sync({forceFull: options.force || !this._snapshot});
  },

  async createSection({title}: {title: string}): Promise<SpaceListSection> {
    const normalizedTitle = this._validateTitle(title);
    const metadata = await this._ensureMetadata();
    const encryptionKey = metadata['default-encryption-key'];

    if (!encryptionKey) {
      throw new UserAppsEncryptionError('Sections metadata has no default encryption key');
    }

    const content = await this.webex.internal.encryption.encryptText(
      encryptionKey,
      normalizedTitle
    );
    const response = await this.webex.request({
      service: USER_APPS_SERVICE,
      resource: `/${SECTIONS_APP}`,
      method: 'POST',
      body: {
        content,
        'encryption-key': encryptionKey,
      },
    });
    const section = response.body as UserAppSectionWire;
    this._upsertSection(section);
    const sectionOrder = this._insertSectionIntoOrder(this._getSectionOrder(), section.id);

    if (!this._getConfiguredSectionOrder().includes(section.id)) {
      await this._tryUpdateSectionOrder(sectionOrder);
    }

    const snapshot = await this._publishSnapshot('mutation');

    return this._requireSection(snapshot, section.id);
  },

  async renameSection({
    sectionId,
    title,
  }: {
    sectionId: string;
    title: string;
  }): Promise<SpaceListSection> {
    this._validateCustomSectionId(sectionId);
    const section = this._getSectionWire(sectionId);
    const normalizedTitle = this._validateTitle(title);
    const content = await this.webex.internal.encryption.encryptText(
      section['encryption-key'],
      normalizedTitle
    );
    const response = await this.webex.request({
      service: USER_APPS_SERVICE,
      resource: `/${SECTIONS_APP}/${encodeURIComponent(sectionId)}`,
      method: 'PUT',
      body: {
        content,
        'encryption-key': section['encryption-key'],
        ...(section.clientSpecificData ? {clientSpecificData: section.clientSpecificData} : {}),
      },
    });

    this._upsertSection({...section, ...response.body, content});
    const snapshot = await this._publishSnapshot('mutation');

    return this._requireSection(snapshot, sectionId);
  },

  async deleteSection({sectionId}: {sectionId: string}): Promise<void> {
    this._validateCustomSectionId(sectionId);
    const listAppName = getSectionListAppName(this._getSectionWire(sectionId));

    await this.webex.request({
      service: USER_APPS_SERVICE,
      resource: `/${SECTIONS_APP}/${encodeURIComponent(sectionId)}`,
      method: 'DELETE',
    });
    this._deleteSectionWire(sectionId, listAppName);
    await this._tryUpdateSectionOrder(this._getSectionOrder());
    await this._publishSnapshot('mutation');
  },

  async reorderSections({sectionIds}: {sectionIds: string[]}): Promise<SpaceListSectionsSnapshot> {
    this._validateSectionOrder(sectionIds);
    await this._updateSectionOrder(sectionIds);

    return this._publishSnapshot('mutation');
  },

  async moveConversationToSection({
    sectionId,
    conversationUrl,
  }: {
    sectionId: string;
    conversationUrl: string;
  }): Promise<SectionMembership> {
    this._validateCustomSectionId(sectionId);
    const section = this._getSectionWire(sectionId);
    const listAppName = getSectionListAppName(section);

    if (!listAppName) {
      throw new UserAppsSyncError('Section list app was missing from the snapshot');
    }

    await this._validateConversationUrl(conversationUrl);
    const response = await this.webex.request({
      service: USER_APPS_SERVICE,
      resource: `/${encodeURIComponent(listAppName)}`,
      method: 'POST',
      body: {'conversation-url': conversationUrl},
    });

    this._removeMembershipByConversationUrl(conversationUrl);
    this._upsertMembership(listAppName, response.body);
    const snapshot = await this._publishSnapshot('mutation');
    const membership = snapshot.membershipsByConversationUrl[conversationUrl];

    if (!membership) {
      throw new UserAppsSyncError('Created section membership was missing from the snapshot');
    }

    return membership;
  },

  async removeConversationFromSection({
    sectionId,
    conversationUrl,
  }: {
    sectionId: string;
    conversationUrl: string;
  }): Promise<void> {
    this._validateCustomSectionId(sectionId);
    await this._validateConversationUrl(conversationUrl);
    const membership = this._snapshot?.membershipsByConversationUrl[conversationUrl];

    if (!membership || membership.sectionId !== sectionId) {
      throw new UserAppsValidationError('Conversation is not a member of the requested section');
    }

    await this.webex.request({
      service: USER_APPS_SERVICE,
      resource: `/${encodeURIComponent(membership.listAppName)}/${encodeURIComponent(
        membership.id
      )}`,
      method: 'DELETE',
    });
    this._removeMembershipByConversationUrl(conversationUrl);
    await this._publishSnapshot('mutation');
  },

  _listenForEvents() {
    this.listenTo(this.webex.internal.mercury, USER_APP_ITEM_EVENT, this._itemEventHandler);
    this.listenTo(this.webex.internal.mercury, USER_APP_METADATA_EVENT, this._metadataEventHandler);
  },

  _handleMercuryEnvelope(eventType: UserAppChangeWire['eventType'], envelope: any) {
    const data = envelope?.data ?? envelope;
    const change = {...data, eventType} as UserAppChangeWire;

    if (!isSectionsAppName(change.appName) || !change.action || !change.appData) {
      return;
    }

    if (this._hydrating) {
      this._queuedChanges.push(change);

      return;
    }

    const lifecycleGeneration = this._lifecycleGeneration;
    const changePromise = this._changePromise
      .catch(() => undefined)
      .then(async () => {
        if (this._isLifecycleActive(lifecycleGeneration)) {
          await this._applyRealtimeChange(change, lifecycleGeneration);
        }
      });

    this._changePromise = changePromise;
    changePromise.catch((error) => {
      if (this._isLifecycleActive(lifecycleGeneration)) {
        this.trigger(
          USER_APPS_SYNC_ERROR,
          new UserAppsSyncError('Unable to apply a user-app event', {cause: error})
        );
      }
    });
  },

  async _applyRealtimeChange(change: UserAppChangeWire, lifecycleGeneration: number) {
    applyChangeToWireData(this._appsData, change);
    await this._publishSnapshot(
      'mercury',
      change,
      this._snapshot?.highWaterMark ?? null,
      this._appsData,
      lifecycleGeneration
    );
  },

  async _fullSync(
    allowRecovery: boolean,
    lifecycleGeneration?: number
  ): Promise<SpaceListSectionsSnapshot> {
    const startedAt = Date.now();
    const response = await this.webex.request({
      service: USER_APPS_SERVICE,
      resource: '/',
      method: 'GET',
    });

    if (!this._canCommitLifecycle(lifecycleGeneration)) {
      return this._getInactiveSnapshot();
    }

    const appsData = (response.body ?? createEmptyWireData()) as UserAppsDataWire;

    await this._loadAdvertisedPages(appsData, lifecycleGeneration);
    await this._filterInvalidMemberships(appsData, lifecycleGeneration);

    if (!this._canCommitLifecycle(lifecycleGeneration)) {
      return this._getInactiveSnapshot();
    }

    const queuedChanges = this._queuedChanges;

    this._queuedChanges = [];
    queuedChanges.forEach((change) => applyChangeToWireData(appsData, change));

    try {
      const snapshot = await this._catchup(
        startedAt,
        allowRecovery,
        false,
        lifecycleGeneration,
        appsData
      );

      if (!this._canCommitLifecycle(lifecycleGeneration)) {
        return this._getInactiveSnapshot();
      }

      this._hydrating = false;
      const trailingChanges = this._queuedChanges;

      this._queuedChanges = [];
      trailingChanges.forEach((change) => applyChangeToWireData(appsData, change));

      return trailingChanges.length
        ? this._publishSnapshot(
            'full-sync',
            undefined,
            snapshot.highWaterMark,
            appsData,
            lifecycleGeneration
          )
        : snapshot;
    } catch (error) {
      if (this._canCommitLifecycle(lifecycleGeneration)) {
        this._hydrating = false;
      }
      throw error;
    }
  },

  async _catchup(
    sinceDate: number,
    allowRecovery: boolean,
    publish?: boolean,
    lifecycleGeneration?: number,
    appsData?: UserAppsDataWire
  ): Promise<SpaceListSectionsSnapshot> {
    const data = appsData ?? this._appsData;
    const shouldPublish = publish ?? true;
    let response;

    try {
      response = await this.webex.request({
        service: USER_APPS_SERVICE,
        resource: CATCHUP_RESOURCE,
        method: 'GET',
        qs: {sinceDate},
      });
    } catch (error) {
      const statusCode = getStatusCode(error);

      if (statusCode && RECOVERABLE_CATCHUP_STATUS_CODES.has(statusCode)) {
        if (allowRecovery) {
          return this._fullSync(false, lifecycleGeneration);
        }

        throw new CatchupResetRequiredError(statusCode, error);
      }

      throw error;
    }

    if (!this._canCommitLifecycle(lifecycleGeneration)) {
      return this._getInactiveSnapshot();
    }

    const body = (response.body ?? {}) as UserAppsCatchupWire | UserAppChangeWire[];
    const changes = Array.isArray(body) ? body : body.items ?? body.changes ?? [];

    changes
      .filter((change) => isSectionsAppName(change.appName))
      .forEach((change) => applyChangeToWireData(data, change));

    const highWaterValue = getHeader(response.headers, HIGH_WATER_HEADER);
    const highWaterMark = highWaterValue ? Number(highWaterValue) : Date.now();

    if (!Number.isFinite(highWaterMark)) {
      throw new UserAppsSyncError('User-app catch-up returned an invalid high-water mark');
    }

    return this._publishSnapshot(
      shouldPublish ? 'catch-up' : 'full-sync',
      undefined,
      highWaterMark,
      data,
      lifecycleGeneration
    );
  },

  async _loadAdvertisedPages(appsData?: UserAppsDataWire, lifecycleGeneration?: number) {
    const data = appsData ?? this._appsData;
    const apps = [
      ...(data.items?.dynamicTop ?? []).filter((app) => app['app-name'] === SECTIONS_APP),
      ...(data.items?.dynamicDerived ?? []).filter(
        (app) => app['app-type'] === 'sections' && isSectionsAppName(app['app-name'])
      ),
    ];

    await Promise.all(
      apps.filter((app) => app.next).map((app) => this._loadPagesForApp(app, lifecycleGeneration))
    );
  },

  async _loadPagesForApp(app: UserAppDerivedWire, lifecycleGeneration?: number) {
    const appName = app['app-name'];
    let {next} = app;
    const seenCursors = new Set<string>();

    while (next) {
      // Pagination is cursor-dependent, so pages must be fetched in order.
      // eslint-disable-next-line no-await-in-loop
      await this._validateContinuationHost(next);
      const cursor = extractCursor(next, appName);

      if (seenCursors.has(cursor)) {
        throw new UserAppsValidationError('User-app continuation repeated a cursor');
      }
      seenCursors.add(cursor);

      // eslint-disable-next-line no-await-in-loop
      const response = await this.webex.request({
        service: USER_APPS_SERVICE,
        resource: `/${encodeURIComponent(appName)}`,
        method: 'GET',
        qs: {cursor},
      });

      if (!this._canCommitLifecycle(lifecycleGeneration)) {
        return;
      }
      const body = response.body ?? {};

      app.items = [...(app.items ?? []), ...(body.items ?? [])] as never;
      next = body.next ?? extractNextFromLink(getHeader(response.headers, 'link'));
    }

    app.next = undefined;
  },

  async _validateContinuationHost(next: string) {
    if (!/^https?:\/\//i.test(next)) {
      return;
    }

    await this._ensureCatalog();
    const service = this.webex.internal.services.getServiceFromUrl(next);

    if (service?.name !== USER_APPS_SERVICE) {
      throw new UserAppsValidationError('User-app continuation used an unrecognized host');
    }
  },

  async _ensureCatalog() {
    if (!this._catalogReadyPromise) {
      this._catalogReadyPromise = this.webex.internal.services.waitForCatalog('postauth');
    }

    await this._catalogReadyPromise;
  },

  async _validateConversationUrl(conversationUrl: string) {
    let parsed: URL;

    try {
      parsed = new URL(conversationUrl);
    } catch (error) {
      throw new UserAppsValidationError('Conversation URL is invalid');
    }

    const match = parsed.pathname.match(CONVERSATION_PATH);

    if (!match) {
      throw new UserAppsValidationError('Conversation URL is invalid');
    }

    await this._ensureCatalog();
    const servicePath = parsed.pathname.slice(0, match.index);
    const service = this.webex.internal.services.getServiceFromUrl(
      `${parsed.origin}${servicePath}`
    );

    if (service?.name !== 'conversation') {
      throw new UserAppsValidationError('Conversation URL uses an unrecognized service');
    }
  },

  async _filterInvalidMemberships(appsData?: UserAppsDataWire, lifecycleGeneration?: number) {
    const data = appsData ?? this._appsData;

    await this._ensureCatalog();
    await Promise.all(
      (data.items?.dynamicDerived ?? [])
        .filter((app) => app['app-type'] === 'sections' && isSectionsAppName(app['app-name']))
        .map(async (app) => {
          const validatedMemberships = await Promise.all(
            (app.items ?? []).map(async (membership) => {
              try {
                await this._validateConversationUrl(membership['conversation-url']);

                return membership;
              } catch (error) {
                this.logger.warn('userApps: ignored an invalid section membership URL');

                return null;
              }
            })
          );

          if (this._canCommitLifecycle(lifecycleGeneration)) {
            app.items = validatedMemberships.filter(Boolean);
          }
        })
    );
  },

  async _publishSnapshot(
    source: SectionChangeSource,
    change?: UserAppChangeWire,
    highWaterMark?: number | null,
    appsData?: UserAppsDataWire,
    lifecycleGeneration?: number
  ): Promise<SpaceListSectionsSnapshot> {
    const snapshotHighWaterMark =
      highWaterMark === undefined ? this._snapshot?.highWaterMark ?? null : highWaterMark;
    const data = appsData ?? this._appsData;
    const publication = this._publicationPromise
      .catch(() => undefined)
      .then(() =>
        this._buildAndPublishSnapshot(
          source,
          change,
          snapshotHighWaterMark,
          data,
          lifecycleGeneration
        )
      );

    this._publicationPromise = publication;

    return publication;
  },

  async _buildAndPublishSnapshot(
    source: SectionChangeSource,
    change: UserAppChangeWire | undefined,
    highWaterMark: number | null,
    appsData: UserAppsDataWire,
    lifecycleGeneration?: number
  ): Promise<SpaceListSectionsSnapshot> {
    const decryptedTitles = new Map<string, string>();
    const unavailableSectionIds = new Set<string>();

    await Promise.all(
      (getSectionsApp(appsData)?.items ?? []).map(async (section) => {
        try {
          const title = await this.webex.internal.encryption.decryptText(
            section['encryption-key'],
            section.content
          );

          decryptedTitles.set(section.id, title);
        } catch (error) {
          unavailableSectionIds.add(section.id);
          this.trigger(
            USER_APPS_SYNC_ERROR,
            new UserAppsEncryptionError('Unable to decrypt a section title', {
              cause: error,
              sectionId: section.id,
            })
          );
        }
      })
    );

    const snapshot = buildSnapshot({
      data: appsData,
      decryptedTitles,
      unavailableSectionIds,
      syncedAt: Date.now(),
      highWaterMark,
    });

    if (this._canCommitLifecycle(lifecycleGeneration)) {
      this._appsData = appsData;
      this._snapshot = snapshot;
      this.trigger(USER_APPS_SECTIONS_CHANGED, {source, snapshot, change});
    }

    return snapshot;
  },

  async _ensureMetadata(): Promise<UserAppsMetadataWire> {
    const existingMetadata = getMetadata(this._appsData);

    if (existingMetadata?.['default-encryption-key']) {
      return existingMetadata;
    }

    if (this._metadataPromise) {
      return this._metadataPromise;
    }

    this._metadataPromise = (async () => {
      try {
        const [key] = await this.webex.internal.encryption.kms.createUnboundKeys({count: 1});
        const request = await this.webex.internal.encryption.kms.prepareRequest({
          method: 'create',
          uri: '/resources',
          ...(this.webex.internal.device.userId
            ? {userIds: [this.webex.internal.device.userId]}
            : {}),
          keyUris: [key.uri],
        });
        const clientSpecificData = {
          sortedSections: DEFAULT_SECTION_ORDER,
          Default_Sections_Settings: [
            {section_name: FAVORITES_SECTION_ID, settings: []},
            {section_name: OTHER_SECTION_ID, settings: []},
          ],
        };
        const response = await this.webex.request({
          service: USER_APPS_SERVICE,
          resource: `/${SECTIONS_APP}`,
          method: 'PUT',
          body: {
            'kms-message': request.wrapped,
            'encryption-key': key.uri,
            clientSpecificData,
          },
        });
        const metadata = (response.body?.metadata ?? response.body) as UserAppsMetadataWire;

        this._setMetadata(metadata);

        return metadata;
      } finally {
        this._metadataPromise = null;
      }
    })();

    return this._metadataPromise;
  },

  async _updateSectionOrder(sectionIds: string[]) {
    const orderUpdate = this._metadataWritePromise
      .catch(() => undefined)
      .then(async () => {
        this._validateSectionOrder(sectionIds);
        const metadata = await this._ensureMetadata();
        const body = {
          ...metadata.clientSpecificData,
          sortedSections: sectionIds,
        };
        const response = await this.webex.request({
          service: USER_APPS_SERVICE,
          resource: `/${SECTIONS_APP}`,
          method: 'PUT',
          body,
        });

        this._setMetadata(
          (response.body?.metadata ?? response.body ?? body) as UserAppsMetadataWire
        );
      });

    this._metadataWritePromise = orderUpdate;

    return orderUpdate;
  },

  async _tryUpdateSectionOrder(sectionIds: string[]) {
    try {
      await this._updateSectionOrder(sectionIds);
    } catch (error) {
      this.logger.warn('userApps: section mutation succeeded but order metadata update failed');
      this.trigger(
        USER_APPS_SYNC_ERROR,
        new UserAppsSyncError('Unable to update section order metadata', {
          cause: error,
          statusCode: getStatusCode(error),
        })
      );
    }
  },

  _setMetadata(metadata: UserAppsMetadataWire) {
    if (!this._appsData.items) {
      this._appsData.items = {};
    }
    const {items} = this._appsData;

    if (!items.dynamicTop) {
      items.dynamicTop = [];
    }
    const {dynamicTop: topApps} = items;
    let sectionsApp = topApps.find((app) => app['app-name'] === SECTIONS_APP);

    if (!sectionsApp) {
      sectionsApp = {'app-name': SECTIONS_APP, items: []};
      topApps.push(sectionsApp);
    }

    sectionsApp.metadata = mergeMetadata(sectionsApp.metadata, metadata);
  },

  _upsertSection(section: UserAppSectionWire) {
    if (!this._appsData.items) {
      this._appsData.items = {};
    }
    const {items} = this._appsData;

    if (!items.dynamicTop) {
      items.dynamicTop = [];
    }
    const {dynamicTop: topApps} = items;
    let sectionsApp = topApps.find((app) => app['app-name'] === SECTIONS_APP);

    if (!sectionsApp) {
      sectionsApp = {'app-name': SECTIONS_APP, items: []};
      topApps.push(sectionsApp);
    }

    if (!sectionsApp.items) {
      sectionsApp.items = [];
    }
    const {items: sections} = sectionsApp;
    const index = sections.findIndex(({id}) => id === section.id);

    if (index >= 0) {
      sections[index] = {...sections[index], ...section};
    } else {
      sections.push(section);
    }
  },

  _deleteSectionWire(sectionId: string, listAppName?: string) {
    const sectionsApp = getSectionsApp(this._appsData);

    if (!sectionsApp || !this._appsData.items) {
      return;
    }

    sectionsApp.items = (sectionsApp.items ?? []).filter(({id}) => id !== sectionId);
    this._appsData.items.dynamicDerived = (this._appsData.items.dynamicDerived ?? []).filter(
      (app) => app['app-name'] !== listAppName
    );
  },

  _upsertMembership(listAppName: string, membership: Record<string, unknown>) {
    if (!this._appsData.items) {
      this._appsData.items = {};
    }
    const {items} = this._appsData;

    if (!items.dynamicDerived) {
      items.dynamicDerived = [];
    }
    const {dynamicDerived: derivedApps} = items;
    let app = derivedApps.find((candidate) => candidate['app-name'] === listAppName);

    if (!app) {
      app = {'app-name': listAppName, 'app-type': 'sections', items: []};
      derivedApps.push(app);
    }

    if (!app.items) {
      app.items = [];
    }
    const {items: memberships} = app;
    const index = memberships.findIndex(({id}) => id === membership.id);

    if (index >= 0) {
      memberships[index] = {...memberships[index], ...membership} as never;
    } else {
      memberships.push(membership as never);
    }
  },

  _removeMembershipByConversationUrl(conversationUrl: string) {
    for (const app of this._appsData.items?.dynamicDerived ?? []) {
      app.items = (app.items ?? []).filter(
        (membership) => membership['conversation-url'] !== conversationUrl
      );
    }
  },

  _getConfiguredSectionOrder(): string[] {
    return getMetadata(this._appsData)?.clientSpecificData?.sortedSections ?? [];
  },

  _getSectionOrder(): string[] {
    const customIds = new Set((getSectionsApp(this._appsData)?.items ?? []).map(({id}) => id));
    const availableIds = new Set([FAVORITES_SECTION_ID, ...customIds, OTHER_SECTION_ID]);
    const sectionOrder = Array.from(
      new Set(this._getConfiguredSectionOrder().filter((id) => availableIds.has(id)))
    );
    const missingCustomIds = Array.from(customIds).filter((id) => !sectionOrder.includes(id));

    if (!sectionOrder.includes(FAVORITES_SECTION_ID)) {
      sectionOrder.unshift(FAVORITES_SECTION_ID);
    }

    if (sectionOrder.includes(OTHER_SECTION_ID)) {
      sectionOrder.splice(sectionOrder.indexOf(OTHER_SECTION_ID), 0, ...missingCustomIds);
    } else {
      sectionOrder.push(...missingCustomIds, OTHER_SECTION_ID);
    }

    return sectionOrder;
  },

  _insertSectionIntoOrder(sectionOrder: string[], sectionId: string): string[] {
    if (sectionOrder.includes(sectionId)) {
      return sectionOrder;
    }

    const nextOrder = [...sectionOrder];
    const otherSectionIndex = nextOrder.indexOf(OTHER_SECTION_ID);

    if (otherSectionIndex >= 0) {
      nextOrder.splice(otherSectionIndex, 0, sectionId);
    } else {
      nextOrder.push(sectionId);
    }

    return nextOrder;
  },

  _validateSectionOrder(sectionIds: string[]) {
    const expectedIds = new Set([
      FAVORITES_SECTION_ID,
      ...(getSectionsApp(this._appsData)?.items ?? []).map(({id}) => id),
      OTHER_SECTION_ID,
    ]);
    const suppliedIds = new Set(sectionIds);

    if (
      suppliedIds.size !== sectionIds.length ||
      suppliedIds.size !== expectedIds.size ||
      Array.from(expectedIds).some((id) => !suppliedIds.has(id))
    ) {
      throw new UserAppsValidationError('Section order must contain every section exactly once');
    }
  },

  _getSectionWire(sectionId: string): UserAppSectionWire {
    const section = getSectionsApp(this._appsData)?.items?.find(({id}) => id === sectionId);

    if (!section) {
      throw new UserAppsValidationError('Section does not exist');
    }

    return section;
  },

  _requireSection(snapshot: SpaceListSectionsSnapshot, sectionId: string): SpaceListSection {
    const section = snapshot.sections.find(({id}) => id === sectionId);

    if (!section) {
      throw new UserAppsSyncError('Section was missing from the normalized snapshot');
    }

    return section;
  },

  _validateCustomSectionId(sectionId: string) {
    if (!sectionId || [FAVORITES_SECTION_ID, OTHER_SECTION_ID].includes(sectionId)) {
      throw new UserAppsValidationError('A custom section ID is required');
    }
  },

  _validateTitle(title: string): string {
    const normalizedTitle = title?.trim();

    if (!normalizedTitle) {
      throw new UserAppsValidationError('A non-empty section title is required');
    }

    return normalizedTitle;
  },

  _isLifecycleCurrent(lifecycleGeneration: number): boolean {
    return lifecycleGeneration === this._lifecycleGeneration;
  },

  _isLifecycleActive(lifecycleGeneration: number): boolean {
    return this.registered && this._isLifecycleCurrent(lifecycleGeneration);
  },

  _canCommitLifecycle(lifecycleGeneration?: number): boolean {
    return lifecycleGeneration === undefined || this._isLifecycleActive(lifecycleGeneration);
  },

  _getInactiveSnapshot(): SpaceListSectionsSnapshot {
    return (
      this._snapshot ??
      buildSnapshot({
        data: createEmptyWireData(),
        decryptedTitles: new Map(),
        unavailableSectionIds: new Set(),
        syncedAt: Date.now(),
        highWaterMark: null,
      })
    );
  },

  _scheduleCatchup() {
    this._clearCatchupTimer();
    this._catchupTimer = setInterval(() => {
      this.sync().catch(() => undefined);
    }, this.config.catchupIntervalMs ?? 14_400_000);
  },

  _clearCatchupTimer() {
    if (this._catchupTimer) {
      clearInterval(this._catchupTimer);
      this._catchupTimer = null;
    }
  },
});

export default UserApps;
