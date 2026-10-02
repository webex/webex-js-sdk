export type UserAppAction = 'create' | 'update' | 'delete';
export type SectionKind = 'custom' | 'favorites' | 'other';
export type SectionChangeSource = 'full-sync' | 'catch-up' | 'mercury' | 'mutation';

export interface UserAppsClientSpecificData {
  sortedSections?: string[];
  Default_Sections_Settings?: Array<{
    section_name: string;
    settings: Array<{name: string; value: string}>;
  }>;
  [key: string]: unknown;
}

export interface UserAppsMetadataWire extends UserAppsClientSpecificData {
  'default-encryption-key'?: string;
  'encryption-key'?: string;
  'kms-message'?: string;
  'kms-resource-object'?: string;
  clientSpecificData?: UserAppsClientSpecificData;
  [key: string]: unknown;
}

export interface UserAppSectionWire {
  id: string;
  url?: string;
  list?: string;
  'list-app-name'?: string;
  content: string;
  'encryption-key': string;
  'date-created'?: string;
  'date-updated'?: string;
  clientSpecificData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UserAppMembershipWire {
  id: string;
  url?: string;
  'app-type'?: 'sections';
  'conversation-url': string;
  'date-created'?: string;
  'date-updated'?: string;
  [key: string]: unknown;
}

export interface UserAppTopWire {
  url?: string;
  'app-name': 'sections';
  metadata?: UserAppsMetadataWire;
  items?: UserAppSectionWire[];
  next?: string;
  [key: string]: unknown;
}

export interface UserAppDerivedWire {
  url?: string;
  'app-name': string;
  'app-type'?: 'sections';
  items?: UserAppMembershipWire[];
  next?: string;
  [key: string]: unknown;
}

export interface UserAppsDataWire {
  items?: {
    static?: Array<Record<string, unknown>>;
    dynamicTop?: UserAppTopWire[];
    dynamicDerived?: UserAppDerivedWire[];
  };
}

export interface UserAppChangeWire {
  eventType?: 'user.app_item' | 'user.app_metadata';
  appName: string;
  action: UserAppAction;
  appData: Record<string, unknown>;
}

export interface UserAppsCatchupWire {
  items?: UserAppChangeWire[];
  changes?: UserAppChangeWire[];
}

export interface SpaceListSection {
  id: string;
  kind: SectionKind;
  title: string | null;
  titleState: 'decrypted' | 'unavailable';
  listAppName?: string;
  conversationUrls: string[];
}

export interface SectionMembership {
  id: string;
  sectionId: string;
  listAppName: string;
  conversationUrl: string;
}

export interface SpaceListSectionsMetadata {
  defaultEncryptionKey?: string;
  sectionOrder: string[];
}

export interface SpaceListSectionsSnapshot {
  sections: SpaceListSection[];
  sectionOrder: string[];
  membershipsByConversationUrl: Record<string, SectionMembership>;
  metadata: SpaceListSectionsMetadata | null;
  syncedAt: number;
  highWaterMark: number | null;
}

export interface UserAppsSectionsChangedEvent {
  source: SectionChangeSource;
  snapshot: SpaceListSectionsSnapshot;
  change?: UserAppChangeWire;
}

export interface SyncOptions {
  forceFull?: boolean;
}
