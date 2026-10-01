import {
  DEFAULT_SECTION_ORDER,
  DERIVED_SECTIONS_PREFIX,
  FAVORITES_SECTION_ID,
  OTHER_SECTION_ID,
  SECTIONS_APP,
  USER_APP_ACTIONS,
} from './constants';
import {UserAppsValidationError} from './errors';
import type {
  SectionMembership,
  SpaceListSection,
  SpaceListSectionsSnapshot,
  UserAppChangeWire,
  UserAppDerivedWire,
  UserAppTopWire,
  UserAppsDataWire,
  UserAppsMetadataWire,
  UserAppSectionWire,
} from './types';

export const createEmptyWireData = (): UserAppsDataWire => ({
  items: {static: [], dynamicTop: [], dynamicDerived: []},
});

export const getSectionsApp = (data: UserAppsDataWire): UserAppTopWire | undefined =>
  data.items?.dynamicTop?.find((app) => app['app-name'] === SECTIONS_APP);

export const getMetadata = (data: UserAppsDataWire): UserAppsMetadataWire | undefined =>
  getSectionsApp(data)?.metadata;

export const isSectionsAppName = (appName?: string): boolean =>
  appName === SECTIONS_APP || Boolean(appName?.startsWith(DERIVED_SECTIONS_PREFIX));

export const getSectionListAppName = (section: UserAppSectionWire): string | undefined => {
  if (section['list-app-name']) {
    return section['list-app-name'];
  }

  if (!section.list) {
    return undefined;
  }

  try {
    const parsed = new URL(section.list, 'https://user-apps.invalid');
    const appName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? '');

    return appName.startsWith(DERIVED_SECTIONS_PREFIX) ? appName : undefined;
  } catch {
    return undefined;
  }
};

export const getStatusCode = (error: any): number | undefined =>
  error?.statusCode ?? error?.response?.statusCode ?? error?.response?.status ?? error?.status;

export const getHeader = (headers: unknown, headerName: string): string | undefined => {
  if (!headers) {
    return undefined;
  }

  if (typeof (headers as any).get === 'function') {
    return (headers as any).get(headerName) ?? undefined;
  }

  const entry = Object.entries(headers as Record<string, unknown>).find(
    ([name]) => name.toLowerCase() === headerName.toLowerCase()
  );

  return entry?.[1] === undefined ? undefined : String(entry[1]);
};

export const extractNextFromLink = (link?: string): string | undefined => {
  if (!link) {
    return undefined;
  }

  const nextLink = link
    .split(',')
    .map((value) => value.trim())
    .find((value) => /;\s*rel=(?:"next"|next)/i.test(value));

  return nextLink?.match(/^<([^>]+)>/)?.[1];
};

export const extractCursor = (next: string, appName: string): string => {
  let parsed: URL;

  try {
    parsed = new URL(next, 'https://user-apps.invalid');
  } catch (error) {
    throw new UserAppsValidationError('Invalid user-app continuation URL');
  }

  const pathAppName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? '');
  const cursor = parsed.searchParams.get('cursor');

  if (pathAppName !== appName || !cursor) {
    throw new UserAppsValidationError('Invalid user-app continuation URL');
  }

  return cursor;
};

const ensureWireArrays = (data: UserAppsDataWire): Required<UserAppsDataWire>['items'] => {
  data.items = data.items ?? {};
  data.items.static = data.items.static ?? [];
  data.items.dynamicTop = data.items.dynamicTop ?? [];
  data.items.dynamicDerived = data.items.dynamicDerived ?? [];

  return data.items as Required<UserAppsDataWire>['items'];
};

export const applyChangeToWireData = (
  data: UserAppsDataWire,
  change: UserAppChangeWire
): UserAppsDataWire => {
  if (!isSectionsAppName(change.appName)) {
    return data;
  }

  const items = ensureWireArrays(data);

  if (change.eventType === 'user.app_metadata') {
    if (change.appName !== SECTIONS_APP) {
      return data;
    }
    let app = items.dynamicTop.find((candidate) => candidate['app-name'] === SECTIONS_APP);

    if (!app && change.action !== USER_APP_ACTIONS.DELETE) {
      app = {'app-name': SECTIONS_APP, items: []};
      items.dynamicTop.push(app);
    }

    if (app) {
      app.metadata =
        change.action === USER_APP_ACTIONS.DELETE
          ? undefined
          : (change.appData as UserAppsMetadataWire);
    }

    return data;
  }

  const apps = change.appName === SECTIONS_APP ? items.dynamicTop : items.dynamicDerived;
  let app = apps.find((candidate) => candidate['app-name'] === change.appName) as
    | UserAppDerivedWire
    | undefined;

  if (!app && change.action === USER_APP_ACTIONS.CREATE) {
    app = {
      'app-name': change.appName,
      ...(change.appName === SECTIONS_APP ? {} : {'app-type': 'sections'}),
      items: [],
    } as UserAppDerivedWire;
    apps.push(app as never);
  }

  if (!app) {
    return data;
  }

  const appItems = (app.items ?? []) as Array<Record<string, unknown>>;
  const itemId = String(change.appData.id ?? '');
  const existingIndex = appItems.findIndex((item) => item.id === itemId);

  if (change.action === USER_APP_ACTIONS.DELETE) {
    if (existingIndex >= 0) {
      appItems.splice(existingIndex, 1);
    }
  } else if (existingIndex >= 0) {
    appItems[existingIndex] = {...appItems[existingIndex], ...change.appData};
  } else {
    appItems.push(change.appData);
  }

  app.items = appItems as never;

  return data;
};

export const buildSnapshot = ({
  data,
  decryptedTitles,
  unavailableSectionIds,
  syncedAt,
  highWaterMark,
}: {
  data: UserAppsDataWire;
  decryptedTitles: Map<string, string>;
  unavailableSectionIds: Set<string>;
  syncedAt: number;
  highWaterMark: number | null;
}): SpaceListSectionsSnapshot => {
  const sectionsApp = getSectionsApp(data);
  const customSections = sectionsApp?.items ?? [];
  const metadata = sectionsApp?.metadata;
  const configuredOrder = metadata?.clientSpecificData?.sortedSections ?? DEFAULT_SECTION_ORDER;
  const customIds = new Set(customSections.map(({id}) => id));
  const availableIds = new Set([FAVORITES_SECTION_ID, ...customIds, OTHER_SECTION_ID]);
  const sectionOrder = Array.from(new Set(configuredOrder.filter((id) => availableIds.has(id))));
  const otherSectionIndex = sectionOrder.indexOf(OTHER_SECTION_ID);
  const missingCustomIds = customSections
    .map(({id}) => id)
    .filter((id) => !sectionOrder.includes(id));

  if (!sectionOrder.includes(FAVORITES_SECTION_ID)) {
    sectionOrder.unshift(FAVORITES_SECTION_ID);
  }

  if (otherSectionIndex >= 0) {
    sectionOrder.splice(sectionOrder.indexOf(OTHER_SECTION_ID), 0, ...missingCustomIds);
  } else {
    sectionOrder.push(...missingCustomIds, OTHER_SECTION_ID);
  }
  const sectionByListAppName = new Map<string, UserAppSectionWire>();

  customSections.forEach((section) => {
    const listAppName = getSectionListAppName(section);

    if (listAppName) {
      sectionByListAppName.set(listAppName, section);
    }
  });
  const membershipsByConversationUrl: Record<string, SectionMembership> = {};
  const conversationsBySectionId = new Map<string, string[]>();

  for (const derivedApp of data.items?.dynamicDerived ?? []) {
    const section = sectionByListAppName.get(derivedApp['app-name']);

    if (section) {
      for (const membership of derivedApp.items ?? []) {
        const conversationUrl = membership['conversation-url'];

        if (conversationUrl && !membershipsByConversationUrl[conversationUrl]) {
          membershipsByConversationUrl[conversationUrl] = {
            id: membership.id,
            sectionId: section.id,
            listAppName: derivedApp['app-name'],
            conversationUrl,
          };
          const conversationUrls = conversationsBySectionId.get(section.id) ?? [];

          conversationUrls.push(conversationUrl);
          conversationsBySectionId.set(section.id, conversationUrls);
        }
      }
    }
  }

  const systemSections: Record<string, SpaceListSection> = {
    [FAVORITES_SECTION_ID]: {
      id: FAVORITES_SECTION_ID,
      kind: 'favorites',
      title: null,
      titleState: 'decrypted',
      conversationUrls: [],
    },
    [OTHER_SECTION_ID]: {
      id: OTHER_SECTION_ID,
      kind: 'other',
      title: null,
      titleState: 'decrypted',
      conversationUrls: [],
    },
  };
  const customById = new Map(
    customSections.map((section) => [
      section.id,
      {
        id: section.id,
        kind: 'custom' as const,
        title: decryptedTitles.get(section.id) ?? null,
        titleState: unavailableSectionIds.has(section.id)
          ? ('unavailable' as const)
          : ('decrypted' as const),
        listAppName: getSectionListAppName(section),
        conversationUrls: conversationsBySectionId.get(section.id) ?? [],
      },
    ])
  );

  return {
    sections: sectionOrder
      .map((sectionId) => systemSections[sectionId] ?? customById.get(sectionId))
      .filter(Boolean) as SpaceListSection[],
    sectionOrder,
    membershipsByConversationUrl,
    metadata: metadata
      ? {
          defaultEncryptionKey: metadata['default-encryption-key'],
          sectionOrder,
        }
      : null,
    syncedAt,
    highWaterMark,
  };
};
