/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See LICENSE file.
 */

// --- Pragya Response DTOs ---

/**
 * Summary data URLs from a Pragya container.
 */
export interface PragyaSummaryData {
  /** Status of the summary (e.g., "Active") */
  status: string;
  /** Full summary URL (AI Bridge) */
  summaryUrl: string;
  /** Transcript URL (AI Bridge) */
  transcriptUrl: string;
  /** Whether summarization runs after call ends */
  summarizeAfterCall: boolean;
  /** Notes-specific URL (may not be present in all API versions) */
  notesUrl?: string;
  /** Action items URL (may not be present in all API versions) */
  actionItemsUrl?: string;
}

/**
 * Complete Pragya container response.
 */
export interface PragyaContainerResponse {
  /** Summary data with content URLs */
  summaryData: PragyaSummaryData;
  /** KMS encryption key URL for decrypting content */
  encryptionKeyUrl: string;
  /** KMS resource object URL */
  kmsResourceObjectUrl: string;
  /** ACL URL for access control */
  aclUrl: string;
  /** Fork session ID */
  forkSessionId: string;
  /** Call session ID */
  callSessionId: string;
  /** Owner user ID */
  ownerUserId: string;
  /** Organization ID */
  orgId: string;
  /** Call start time */
  start: string;
  /** Call end time */
  end: string;
}

// --- Request DTOs ---

/**
 * Options for resolving a Pragya container.
 */
export interface GetContainerOptions {
  /** Pragya container ID (from Janus extensionPayload.callingContainerIds) */
  containerId: string;
}

/**
 * Options for fetching summary content.
 * Requires the resolved Pragya container info.
 */
export interface GetSummaryContentOptions {
  /** The resolved Pragya container response */
  containerInfo: PragyaContainerResponse;
}

// --- Summary Response DTOs ---

/**
 * Decrypted AI-generated summary content.
 * Contains all three content types returned by the summary API.
 */
export interface SummaryContent {
  /** Unique identifier */
  id: string;
  /** Decrypted full note content */
  note: string;
  /** Decrypted short note content */
  shortNote: string;
  /** Decrypted action item snippets */
  actionItems: ActionItemSnippet[];
  /** Feedback URL (if available) */
  feedbackUrl?: string;
}

/**
 * Decrypted AI-generated notes.
 */
export interface SummaryNotes {
  /** Unique identifier */
  id: string;
  /** Decrypted notes content */
  content: string;
  /** Feedback URL (if available) */
  feedbackUrl?: string;
}

/**
 * Single action item snippet.
 */
export interface ActionItemSnippet {
  /** Unique identifier */
  id: string;
  /** User-edited version (if available) */
  editedContent?: string;
  /** Decrypted AI-generated content */
  aiGeneratedContent: string;
}

/**
 * Decrypted AI-generated action items.
 */
export interface SummaryActionItems {
  /** Unique identifier (absent when no action items exist) */
  id?: string;
  /** Array of action item snippets */
  snippets: ActionItemSnippet[];
  /** Feedback URL (if available) */
  feedbackUrl?: string;
}

/**
 * Single decrypted transcript snippet.
 */
export interface TranscriptSnippet {
  /** Start time in milliseconds */
  startTime: string;
  /** End time in milliseconds */
  endTime: string;
  /** Decrypted transcript content */
  content: string;
  /** Audio CSI identifier */
  audioCSI?: string;
  /** Speaker information */
  speaker?: {
    speakerName: string;
    speakerId: string;
  };
}

/**
 * Decrypted transcript response.
 */
export interface TranscriptContent {
  /** Unique identifier */
  id: string;
  /** Total number of snippets */
  totalCount: number;
  /** Decrypted transcript snippets */
  snippets: TranscriptSnippet[];
}
