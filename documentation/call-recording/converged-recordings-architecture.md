# Converged Call Recordings Architecture

## 1. Overview
The Webex JS SDK will provide call recording retrieval capabilities through a new **`plugin-recordings`** public plugin. This document describes the architecture for exposing the Webex **Converged Recordings API** (`/v1/convergedRecordings`) to SDK users, enabling them to retrieve call recording details, download links, AI-generated summaries, and transcripts programmatically.

### API Source
- **Correct API**: `https://webexapis.com/v1/convergedRecordings/{recordingId}`
- **Service Type**: `calling` (not meetings)
- **Format**: MP3 audio (not video formats)

### Implementation Status
**Planned:** New public plugin to expose converged recordings REST APIs with proper authentication, error handling, and type-safe interfaces.

### Goals
- List call recordings for authenticated user
- Retrieve call recording details by recording ID
- Provide temporary download links for audio files (expire after 3 hours)
- Extract AI-generated summaries (full suggested notes and short notes)
- Extract action items from recordings  
- Provide transcript download links
- Maintain consistency with existing Webex JS SDK patterns and architecture
- Provide type-safe interfaces for all operations
- Support both browser and Node.js environments

### Non-Goals
- Implement recording upload or creation (managed by Webex backend during calls)
- Provide direct file download handling (return URLs for client implementation)
- Implement recording playback UI components
- Handle recording format conversion
- Delete recordings (use separate Webex Calling APIs)
- Provide real-time recording status updates via websockets
- Advanced filtering/search by topic, date range, etc. (use basic list only)

## 2. High-Level Design

### 2.1 Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Application                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ webex.recordings.*
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   plugin-recordings                          │
│                    (Public Plugin)                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Public API Methods                                  │   │
│  │  - listRecordings()                                 │   │
│  │  - getRecordingDetails()                            │   │
│  │  - getRecordingDownloadLinks()                      │   │
│  │  - getRecordingSummary()                            │   │
│  │  - getRecordingTranscript()                         │   │
│  │  - getRecordingActionItems()                        │   │
│  └─────────────────────────┬───────────────────────────┘   │
│                            │                                 │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │  Internal Logic                                      │   │
│  │  - Request validation                                │   │
│  │  - Response normalization                            │   │
│  │  - Error handling & mapping                          │   │
│  │  - Download link extraction                          │   │
│  │  - Summary extraction                                │   │
│  └─────────────────────────┬───────────────────────────┘   │
└────────────────────────────┼─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                      http-core                               │
│  - Authorization headers (Bearer token)                      │
│  - Request/Response interceptors                             │
│  - Retry logic                                               │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│            Webex Converged Recordings API                    │
│         https://webexapis.com/v1/convergedRecordings         │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Key Components

| Component | Responsibility |
|-----------|-----------------|
| `plugin-recordings` | **Public plugin** exposing call recording retrieval APIs; handles request/response transformation and content extraction |
| `http-core` | HTTP transport layer; adds authorization headers, handles retries and base URL configuration |
| `plugin-authorization` | OAuth2 token management; ensures valid bearer tokens for API requests |
| Type Definitions (`types.ts`) | TypeScript interfaces for recording details, download links, summaries, and transcripts |
| Constants (`constants.ts`) | API endpoints, error codes, validation rules, link expiration times |
| Error Handlers | Maps HTTP errors to meaningful SDK error objects |
| Content Extractors | Helper methods to extract specific content (audio, summary, transcript) from API responses |

## 3. Data Flow

### 3.1 List Recordings Flow
```
Client
  └─> webex.recordings.listRecordings()
        └─> http-core.request(GET /v1/convergedRecordings)
            └─> Add Authorization: Bearer <token>
            └─> Add Accept: application/json;charset=UTF-8
                └─> Webex Converged Recordings API
                    └─> Response: {
                          items: [
                            { id, topic, createTime, timeRecorded,
                              ownerId, ownerEmail, format,
                              durationSeconds, sizeBytes,
                              serviceType: 'calling', status,
                              storageRegion, serviceData
                            },
                            ...
                          ]
                        }
                        └─> Transform to RecordingsListResponse
                            └─> Client receives array of recording summaries
```

### 3.2 Get Recording Details Flow
```
Client
  └─> webex.recordings.getRecordingDetails({ recordingId: 'abc123' })
        └─> Validate recordingId (non-empty string)
            └─> http-core.request(GET /v1/convergedRecordings/{recordingId})
                └─> Add Authorization: Bearer <token>
                └─> Add Accept: application/json;charset=UTF-8
                    └─> Webex Converged Recordings API
                        └─> Response: {
                              id, topic, createTime, timeRecorded,
                              temporaryDirectDownloadLinks: {
                                audioDownloadLink,
                                transcriptDownloadLink,
                                suggestedNotesDownloadLink,
                                shortNotesDownloadLink,
                                actionItemsDownloadLink,
                                expiration
                              },
                              format, durationSeconds, serviceType: 'calling',
                              status, storageRegion, serviceData, ...
                            }
                            └─> Transform to CallRecordingDetails
                                └─> Client receives typed response
```

### 3.2 Get Recording Summary Flow
```
Client
  └─> webex.recordings.getRecordingSummary({ 
        recordingId: 'abc123',
        summaryType: 'full' // or 'short'
      })
        └─> Call getRecordingDetails internally
            └─> Extract suggestedNotesDownloadLink or shortNotesDownloadLink
                └─> Return download URL with expiration time
                    └─> Client can download summary content
```

### 3.3 Get Recording Transcript Flow
```
Client
  └─> webex.recordings.getRecordingTranscript({ recordingId: 'abc123' })
        └─> Call getRecordingDetails internally
            └─> Extract transcriptDownloadLink from temporaryDirectDownloadLinks
                └─> Return transcript download URL with expiration
                    └─> Client can download transcript file
```

### 3.4 Get All Download Links Flow
```
Client
  └─> webex.recordings.getRecordingDownloadLinks({ recordingId: 'abc123' })
        └─> Call getRecordingDetails internally
            └─> Extract entire temporaryDirectDownloadLinks object
                └─> Return all available download links:
                    - audioDownloadLink (MP3 audio file)
                    - transcriptDownloadLink (transcript text)
                    - suggestedNotesDownloadLink (AI summary)
                    - shortNotesDownloadLink (short AI summary)
                    - actionItemsDownloadLink (action items)
                    - expiration (3 hours from API call)
                        └─> Client receives all links for download
```

## 4. SDK Method Interfaces

### 4.1 Public API Methods

```typescript
/**
 * Recordings namespace accessible via webex.recordings
 */
interface Recordings {
  /**
   * List all call recordings for the authenticated user
   * Returns recording summaries without download links
   */
  listRecordings(): Promise<RecordingsListResponse>;

  /**
   * Get detailed information about a specific call recording
   * Includes temporary download links that expire after 3 hours
   */
  getRecordingDetails(options: GetRecordingDetailsOptions): Promise<CallRecordingDetails>;

  /**
   * Get all available download links for a recording
   * Returns audio, transcript, summaries, and action items download URLs
   */
  getRecordingDownloadLinks(options: GetRecordingDetailsOptions): Promise<RecordingDownloadLinks>;

  /**
   * Get the AI-generated summary (notes) download link for a recording
   * @param options.summaryType - 'full' for suggestedNotes, 'short' for shortNotes
   */
  getRecordingSummary(options: GetRecordingSummaryOptions): Promise<RecordingSummaryLink>;

  /**
   * Get the transcript download link for a recording
   */
  getRecordingTranscript(options: GetRecordingDetailsOptions): Promise<RecordingTranscriptLink>;

  /**
   * Get the action items download link for a recording
   */
  getRecordingActionItems(options: GetRecordingDetailsOptions): Promise<RecordingActionItemsLink>;
}
```

## 5. Data Transfer Objects (DTOs)

### 5.1 Request DTOs

```typescript
/**
 * Options for getting recording details
 */
export interface GetRecordingDetailsOptions {
  /**
   * The unique identifier for the recording
   */
  recordingId: string;
}

/**
 * Options for getting recording summary
 */
export interface GetRecordingSummaryOptions extends GetRecordingDetailsOptions {
  /**
   * Type of summary to retrieve
   * @default 'full'
   */
  summaryType?: 'full' | 'short';
}
```

### 5.2 Response DTOs

```typescript
/**
 * Response from listing recordings
 */
export interface RecordingsListResponse {
  /**
   * Array of recording summaries
   */
  items: RecordingSummary[];
}

/**
 * Summary of a call recording (from list operation)
 * Does not include download links - use getRecordingDetails() for those
 */
export interface RecordingSummary {
  /**
   * Unique identifier for the recording
   */
  id: string;

  /**
   * Topic/title of the recorded call
   */
  topic: string;

  /**
   * When the recording was created (ISO 8601)
   */
  createTime: string;

  /**
   * When the call was actually recorded (ISO 8601)
   */
  timeRecorded: string;

  /**
   * Owner ID (user UUID)
   */
  ownerId: string;

  /**
   * Owner type (typically 'user')
   */
  ownerType: string;

  /**
   * Owner email address
   */
  ownerEmail: string;

  /**
   * Recording format (e.g., 'MP3' for audio)
   */
  format: AudioFormat;

  /**
   * Duration of the recording in seconds
   */
  durationSeconds: number;

  /**
   * Size of the recording file in bytes
   */
  sizeBytes: number;

  /**
   * Service type - always 'calling' for call recordings
   */
  serviceType: 'calling';

  /**
   * Storage region (e.g., 'US', 'EU')
   */
  storageRegion: string;

  /**
   * Current status of the recording
   */
  status: RecordingStatus;

  /**
   * Service-specific data
   */
  serviceData: {
    /**
     * Location ID where the call originated
     */
    locationId: string;

    /**
     * Call session ID
     */
    callSessionId: string;
  };
}

/**
 * Detailed call recording information from Converged Recordings API
 * Extends RecordingSummary with download links
 */
export interface CallRecordingDetails extends RecordingSummary {
  /**
   * Unique identifier for the recording
   */
  id: string;

  /**
   * Topic/title of the recorded call
   */
  topic: string;

  /**
   * When the recording was created (ISO 8601)
   */
  createTime: string;

  /**
   * When the call was actually recorded (ISO 8601)
   */
  timeRecorded: string;

  /**
   * Temporary direct download links
   * These links expire 3 hours after the API request
   */
  temporaryDirectDownloadLinks: RecordingDownloadLinks;

  /**
   * Owner ID (user UUID)
   */
  ownerId: string;

  /**
   * Owner type (typically 'user')
   */
  ownerType: string;

  /**
   * Owner email address
   */
  ownerEmail: string;

  /**
   * Recording format (e.g., 'MP3' for audio)
   */
  format: AudioFormat;

  /**
   * Duration of the recording in seconds
   */
  durationSeconds: number;

  /**
   * Size of the recording file in bytes
   */
  sizeBytes: number;

  /**
   * Service type - always 'calling' for call recordings
   */
  serviceType: 'calling';

  /**
   * Storage region (e.g., 'US', 'EU')
   */
  storageRegion: string;

  /**
   * Current status of the recording
   */
  status: RecordingStatus;

  /**
   * Service-specific data
   */
  serviceData: {
    /**
     * Location ID where the call originated
     */
    locationId: string;

    /**
     * Call session ID
     */
    callSessionId: string;
  };
}

/**
 * Download links for recording content
 * All links expire 3 hours after the API request
 */
export interface RecordingDownloadLinks {
  /**
   * Download link for recording audio file (MP3)
   * Direct download without HTML page rendering or HTTP redirect
   */
  audioDownloadLink: string;

  /**
   * Download link for AI-generated suggested notes (full summary)
   * User access token required to download
   */
  suggestedNotesDownloadLink?: string;

  /**
   * Download link for action items extracted from the recording
   * User access token required to download
   */
  actionItemsDownloadLink?: string;

  /**
   * Download link for AI-generated short notes (concise summary)
   * User access token required to download
   */
  shortNotesDownloadLink?: string;

  /**
   * Download link for recording transcript
   * Direct download without HTML page rendering or HTTP redirect
   */
  transcriptDownloadLink?: string;

  /**
   * When all these temporary links will expire (ISO 8601)
   * Typically 3 hours from the API request time
   */
  expiration: string;
}

/**
 * Recording summary link response
 */
export interface RecordingSummaryLink {
  /**
   * Download URL for the summary
   */
  downloadUrl: string;

  /**
   * Type of summary ('full' or 'short')
   */
  summaryType: 'full' | 'short';

  /**
   * When this link expires (ISO 8601)
   */
  expiration: string;
}

/**
 * Recording transcript link response
 */
export interface RecordingTranscriptLink {
  /**
   * Download URL for the transcript
   */
  downloadUrl: string;

  /**
   * When this link expires (ISO 8601)
   */
  expiration: string;
}

/**
 * Recording action items link response
 */
export interface RecordingActionItemsLink {
  /**
   * Download URL for the action items
   */
  downloadUrl: string;

  /**
   * When this link expires (ISO 8601)
   */
  expiration: string;
}
```

### 5.3 Enums and Constants

```typescript
/**
 * Audio recording format types
 */
export enum AudioFormat {
  MP3 = 'MP3',           // MP3 audio format (most common for call recordings)
  WAV = 'WAV',           // WAV audio format
  M4A = 'M4A',           // MPEG-4 audio format
}

/**
 * Recording status values
 */
export enum RecordingStatus {
  AVAILABLE = 'available',           // Recording is ready to view/download
  PROCESSING = 'processing',         // Recording is being processed
  FAILED = 'failed',                 // Recording processing failed
  DELETED = 'deleted',               // Recording has been deleted
  EXPIRED = 'expired',               // Recording has expired and is no longer available
}

/**
 * Storage regions for recordings
 */
export enum StorageRegion {
  US = 'US',             // United States
  EU = 'EU',             // European Union
  APAC = 'APAC',         // Asia Pacific
}

/**
 * Summary types
 */
export enum SummaryType {
  FULL = 'full',         // Full suggested notes
  SHORT = 'short',       // Concise short notes
}
```

## 6. Low-Level Design & Pseudo Code

### 6.1 Plugin Structure

```typescript
// packages/@webex/plugin-recordings/src/recordings.ts

import { WebexPlugin } from '@webex/webex-core';
import { HttpResponseError } from '@webex/http-core';
import {
  GetRecordingDetailsOptions,
  GetRecordingSummaryOptions,
  RecordingsListResponse,
  RecordingSummary,
  CallRecordingDetails,
  RecordingDownloadLinks,
  RecordingSummaryLink,
  RecordingTranscriptLink,
  RecordingActionItemsLink,
} from './types';
import { CONVERGED_RECORDINGS_API_BASE_URL, LINK_EXPIRATION_HOURS } from './constants';

/**
 * Public plugin for managing Webex call recordings
 * Accessible via webex.recordings.*
 */
export class Recordings extends WebexPlugin {
  namespace = 'Recordings';

  /**
   * List all call recordings for the authenticated user
   * Returns recording summaries without download links
   */
  async listRecordings(): Promise<RecordingsListResponse> {
    this.logger.info('listRecordings called');

    try {
      // Make API request
      const response = await this.request({
        method: 'GET',
        uri: `${CONVERGED_RECORDINGS_API_BASE_URL}/convergedRecordings`,
        headers: {
          'Accept': 'application/json;charset=UTF-8',
        },
      });

      // Transform response
      return this._transformListResponse(response.body);
    } catch (error) {
      this.logger.error('listRecordings failed', { error });
      throw this._handleError(error, 'listRecordings');
    }
  }

  /**
   * Get detailed information about a specific call recording
   * Includes all temporary download links that expire after 3 hours
   */
  async getRecordingDetails(
    options: GetRecordingDetailsOptions
  ): Promise<CallRecordingDetails> {
    this.logger.info('getRecordingDetails called', { recordingId: options.recordingId });

    try {
      // Validate options
      this._validateRecordingId(options.recordingId);

      // Make API request
      const response = await this.request({
        method: 'GET',
        uri: `${CONVERGED_RECORDINGS_API_BASE_URL}/convergedRecordings/${options.recordingId}`,
        headers: {
          'Accept': 'application/json;charset=UTF-8',
        },
      });

      // Transform response
      return this._transformRecordingDetails(response.body);
    } catch (error) {
      this.logger.error('getRecordingDetails failed', { error, options });
      throw this._handleError(error, 'getRecordingDetails');
    }
  }

  /**
   * Get all available download links for a recording
   */
  async getRecordingDownloadLinks(
    options: GetRecordingDetailsOptions
  ): Promise<RecordingDownloadLinks> {
    this.logger.info('getRecordingDownloadLinks called', { recordingId: options.recordingId });

    try {
      const details = await this.getRecordingDetails(options);
      return details.temporaryDirectDownloadLinks;
    } catch (error) {
      this.logger.error('getRecordingDownloadLinks failed', { error, options });
      throw this._handleError(error, 'getRecordingDownloadLinks');
    }
  }

  /**
   * Get the AI-generated summary download link
   */
  async getRecordingSummary(
    options: GetRecordingSummaryOptions
  ): Promise<RecordingSummaryLink> {
    this.logger.info('getRecordingSummary called', { 
      recordingId: options.recordingId,
      summaryType: options.summaryType 
    });

    try {
      const details = await this.getRecordingDetails(options);
      const links = details.temporaryDirectDownloadLinks;
      const summaryType = options.summaryType || 'full';

      let downloadUrl: string;
      if (summaryType === 'short') {
        if (!links.shortNotesDownloadLink) {
          throw new Error('Short summary not available for this recording');
        }
        downloadUrl = links.shortNotesDownloadLink;
      } else {
        if (!links.suggestedNotesDownloadLink) {
          throw new Error('Summary not available for this recording');
        }
        downloadUrl = links.suggestedNotesDownloadLink;
      }

      return {
        downloadUrl,
        summaryType,
        expiration: links.expiration,
      };
    } catch (error) {
      this.logger.error('getRecordingSummary failed', { error, options });
      throw this._handleError(error, 'getRecordingSummary');
    }
  }

  /**
   * Get the transcript download link
   */
  async getRecordingTranscript(
    options: GetRecordingDetailsOptions
  ): Promise<RecordingTranscriptLink> {
    this.logger.info('getRecordingTranscript called', { recordingId: options.recordingId });

    try {
      const details = await this.getRecordingDetails(options);
      const links = details.temporaryDirectDownloadLinks;

      if (!links.transcriptDownloadLink) {
        throw new Error('Transcript not available for this recording');
      }

      return {
        downloadUrl: links.transcriptDownloadLink,
        expiration: links.expiration,
      };
    } catch (error) {
      this.logger.error('getRecordingTranscript failed', { error, options });
      throw this._handleError(error, 'getRecordingTranscript');
    }
  }

  /**
   * Get the action items download link
   */
  async getRecordingActionItems(
    options: GetRecordingDetailsOptions
  ): Promise<RecordingActionItemsLink> {
    this.logger.info('getRecordingActionItems called', { recordingId: options.recordingId });

    try {
      const details = await this.getRecordingDetails(options);
      const links = details.temporaryDirectDownloadLinks;

      if (!links.actionItemsDownloadLink) {
        throw new Error('Action items not available for this recording');
      }

      return {
        downloadUrl: links.actionItemsDownloadLink,
        expiration: links.expiration,
      };
    } catch (error) {
      this.logger.error('getRecordingActionItems failed', { error, options });
      throw this._handleError(error, 'getRecordingActionItems');
    }
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Validate recording ID
   */
  private _validateRecordingId(recordingId: string): void {
    if (!recordingId || typeof recordingId !== 'string' || recordingId.trim().length === 0) {
      throw new Error('recordingId is required and must be a non-empty string');
    }
  }

  /**
   * Transform list API response to SDK format
   */
  private _transformListResponse(body: any): RecordingsListResponse {
    const items: RecordingSummary[] = (body.items || []).map((item: any) =>
      this._transformRecordingSummary(item)
    );

    return { items };
  }

  /**
   * Transform a single recording summary
   */
  private _transformRecordingSummary(body: any): RecordingSummary {
    return {
      id: body.id,
      topic: body.topic,
      createTime: body.createTime,
      timeRecorded: body.timeRecorded,
      ownerId: body.ownerId,
      ownerType: body.ownerType,
      ownerEmail: body.ownerEmail,
      format: body.format,
      durationSeconds: body.durationSeconds,
      sizeBytes: body.sizeBytes,
      serviceType: body.serviceType,
      storageRegion: body.storageRegion,
      status: body.status,
      serviceData: body.serviceData,
    };
  }

  /**
   * Transform detailed recording API response to SDK format
   */
  private _transformRecordingDetails(body: any): CallRecordingDetails {
    // Get base recording info
    const summary = this._transformRecordingSummary(body);

    // Add download links
    return {
      ...summary,
      temporaryDirectDownloadLinks: {
        audioDownloadLink: body.temporaryDirectDownloadLinks.audioDownloadLink,
        suggestedNotesDownloadLink: body.temporaryDirectDownloadLinks.suggestedNotesDownloadLink,
        actionItemsDownloadLink: body.temporaryDirectDownloadLinks.actionItemsDownloadLink,
        shortNotesDownloadLink: body.temporaryDirectDownloadLinks.shortNotesDownloadLink,
        transcriptDownloadLink: body.temporaryDirectDownloadLinks.transcriptDownloadLink,
        expiration: body.temporaryDirectDownloadLinks.expiration,
      },
    };
  }

  /**
   * Handle and transform errors
   */
  private _handleError(error: any, operation: string): Error {
    if (error instanceof HttpResponseError) {
      const statusCode = error.statusCode;
      
      switch (statusCode) {
        case 400:
          return new Error(`${operation}: Invalid recording ID or request parameters`);
        case 401:
          return new Error(`${operation}: Unauthorized - please authenticate`);
        case 403:
          return new Error(`${operation}: Forbidden - insufficient permissions to access this recording`);
        case 404:
          return new Error(`${operation}: Recording not found`);
        case 429:
          return new Error(`${operation}: Rate limit exceeded - please try again later`);
        case 500:
        case 502:
        case 503:
          return new Error(`${operation}: Service temporarily unavailable`);
        default:
          return new Error(`${operation}: HTTP ${statusCode} - ${error.message}`);
      }
    }

    return new Error(`${operation}: ${error.message || 'Unknown error occurred'}`);
  }
}
```

### 6.2 Constants

```typescript
// packages/@webex/plugin-recordings/src/constants.ts

/**
 * Base URL for Converged Recordings API
 */
export const CONVERGED_RECORDINGS_API_BASE_URL = 'https://webexapis.com/v1';

/**
 * Link expiration time in hours
 */
export const LINK_EXPIRATION_HOURS = 3;

/**
 * Supported audio formats
 */
export const AUDIO_FORMATS = ['MP3', 'WAV', 'M4A'] as const;

/**
 * Supported recording statuses
 */
export const RECORDING_STATUSES = [
  'available',
  'processing',
  'failed',
  'deleted',
  'expired',
] as const;

/**
 * Storage regions
 */
export const STORAGE_REGIONS = ['US', 'EU', 'APAC'] as const;

/**
 * Event names for recordings events (future use)
 */
export const RECORDING_EVENTS = {
  RECORDING_STATUS_CHANGED: 'recording:status:changed',
  RECORDING_AVAILABLE: 'recording:available',
} as const;
```

### 6.3 Usage Examples

```typescript
// Example 1: List all recordings for authenticated user
const recordings = await webex.recordings.listRecordings();

console.log(`Found ${recordings.items.length} recordings`);
recordings.items.forEach((recording) => {
  console.log(`- ${recording.topic}`);
  console.log(`  ID: ${recording.id}`);
  console.log(`  Duration: ${recording.durationSeconds}s`);
  console.log(`  Format: ${recording.format}`);
  console.log(`  Owner: ${recording.ownerEmail}`);
  console.log(`  Status: ${recording.status}`);
  console.log(`  Created: ${recording.createTime}`);
});

// Example 2: Get complete recording details with download links
const details = await webex.recordings.getRecordingDetails({
  recordingId: '62807eaf-0c89-492e-a3c3-c4751812603b',
});

console.log(`Recording: ${details.topic}`);
console.log(`Duration: ${details.durationSeconds}s`);
console.log(`Format: ${details.format}`);
console.log(`Owner: ${details.ownerEmail}`);
console.log(`Storage Region: ${details.storageRegion}`);

// Example 3: Get all download links
const links = await webex.recordings.getRecordingDownloadLinks({
  recordingId: '62807eaf-0c89-492e-a3c3-c4751812603b',
});

console.log(`Audio download: ${links.audioDownloadLink}`);
console.log(`Transcript: ${links.transcriptDownloadLink || 'Not available'}`);
console.log(`Summary: ${links.suggestedNotesDownloadLink || 'Not available'}`);
console.log(`Short Summary: ${links.shortNotesDownloadLink || 'Not available'}`);
console.log(`Action Items: ${links.actionItemsDownloadLink || 'Not available'}`);
console.log(`Links expire: ${links.expiration}`);

// Example 4: Get full AI-generated summary
try {
  const summary = await webex.recordings.getRecordingSummary({
    recordingId: '62807eaf-0c89-492e-a3c3-c4751812603b',
    summaryType: 'full', // or 'short'
  });
  
  console.log(`Summary download URL: ${summary.downloadUrl}`);
  console.log(`Expires: ${summary.expiration}`);
  
  // Client can now download the summary file
  // fetch(summary.downloadUrl, {
  //   headers: { 'Authorization': `Bearer ${token}` }
  // });
} catch (error) {
  console.error('Summary not available:', error.message);
}

// Example 5: Get transcript
try {
  const transcript = await webex.recordings.getRecordingTranscript({
    recordingId: '62807eaf-0c89-492e-a3c3-c4751812603b',
  });
  
  console.log(`Transcript URL: ${transcript.downloadUrl}`);
  console.log(`Expires: ${transcript.expiration}`);
} catch (error) {
  console.error('Transcript not available:', error.message);
}

// Example 6: Get action items
try {
  const actionItems = await webex.recordings.getRecordingActionItems({
    recordingId: '62807eaf-0c89-492e-a3c3-c4751812603b',
  });
  
  console.log(`Action items URL: ${actionItems.downloadUrl}`);
} catch (error) {
  console.error('Action items not available:', error.message);
}

// Example 7: Error handling
try {
  const recording = await webex.recordings.getRecordingDetails({
    recordingId: 'invalid-id',
  });
} catch (error) {
  if (error.message.includes('not found')) {
    console.error('Recording does not exist');
  } else if (error.message.includes('Unauthorized')) {
    console.error('Please authenticate first');
  } else if (error.message.includes('Forbidden')) {
    console.error('You do not have permission to access this recording');
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

## 7. Error Handling

### 7.1 Error Types

| HTTP Status | SDK Error | Description |
|-------------|-----------|-------------|
| 400 | `InvalidRequestError` | Invalid recording ID or malformed request |
| 401 | `UnauthorizedError` | Missing or invalid authentication token |
| 403 | `ForbiddenError` | Insufficient permissions to access recording |
| 404 | `NotFoundError` | Recording does not exist |
| 429 | `RateLimitError` | Too many requests, rate limit exceeded |
| 500 | `ServerError` | Internal server error |
| 502/503 | `ServiceUnavailableError` | Service temporarily unavailable |

### 7.2 Error Handling Strategy

```typescript
// Retry logic for transient errors
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

private async _requestWithRetry(options: any, retries = 0): Promise<any> {
  try {
    return await this.request(options);
  } catch (error) {
    if (
      error instanceof HttpResponseError &&
      RETRYABLE_STATUS_CODES.includes(error.statusCode) &&
      retries < MAX_RETRIES
    ) {
      await this._sleep(RETRY_DELAY_MS * Math.pow(2, retries));
      return this._requestWithRetry(options, retries + 1);
    }
    throw error;
  }
}

private _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

## 8. Security & Privacy Considerations

### 8.1 Authentication
- All API requests require valid OAuth2 Bearer token
- Token scopes required: `spark:calls_read` or appropriate calling scopes
- SDK will automatically refresh expired tokens via `plugin-authorization`

### 8.2 Data Privacy
- Do not log sensitive information (download URLs with embedded tokens)
- Mask recording IDs in non-debug logs
- Temporary download links expire after 3 hours and should not be stored permanently
- Some links (notes, action items) require user access token for download

### 8.3 Download Link Security
- `audioDownloadLink` and `transcriptDownloadLink`: Direct download without authentication
- `suggestedNotesDownloadLink`, `shortNotesDownloadLink`, `actionItemsDownloadLink`: Require user access token

```typescript
// Privacy-safe logging
this.logger.info('Recording retrieved', {
  recordingId: this._maskId(recordingId),
  operation: 'getRecordingDetails',
});

private _maskId(id: string): string {
  if (id.length <= 8) return '***';
  return id.substring(0, 4) + '***' + id.substring(id.length - 4);
}
```

## 9. Performance Considerations

### 9.1 Caching Strategy
- **Recording details**: Cache for 5 minutes per recording ID
- **Temporary download links**: Do not cache (they expire after 3 hours)
- Invalidate cache when recording status changes

```typescript
// Simple in-memory cache with TTL
private _cache = new Map<string, { data: any; expiry: number }>();

private _getCached(key: string): any | null {
  const cached = this._cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }
  this._cache.delete(key);
  return null;
}

private _setCache(key: string, data: any, ttlMs: number): void {
  this._cache.set(key, {
    data,
    expiry: Date.now() + ttlMs,
  });
}
```

### 9.2 Rate Limiting
- Webex API enforces rate limits (typically 100 requests/minute per token)
- SDK implements exponential backoff for 429 responses
- Consider client-side caching to reduce API calls

## 10. Testing Strategy

### 10.1 Unit Tests

```typescript
describe('Recordings Plugin', () => {
  describe('listRecordings', () => {
    it('should make correct API call', async () => {
      const mockRequest = jest.fn().mockResolvedValue({ 
        body: { items: [] } 
      });
      recordings.request = mockRequest;

      await recordings.listRecordings();

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          uri: expect.stringContaining('/convergedRecordings'),
        })
      );
    });

    it('should transform response correctly', async () => {
      const mockResponse = {
        body: {
          items: [
            {
              id: 'rec123',
              topic: 'Test Call',
              durationSeconds: 60,
              format: 'MP3',
              serviceType: 'calling',
            },
          ],
        },
      };

      recordings.request = jest.fn().mockResolvedValue(mockResponse);
      const result = await recordings.listRecordings();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('rec123');
      expect(result.items[0].serviceType).toBe('calling');
    });
  });

  describe('getRecordingDetails', () => {
    it('should validate recordingId', async () => {
      await expect(
        recordings.getRecordingDetails({ recordingId: '' })
      ).rejects.toThrow('recordingId is required');
    });

    it('should make correct API call', async () => {
      const mockRequest = jest.fn().mockResolvedValue({ 
        body: mockRecordingResponse 
      });
      recordings.request = mockRequest;

      await recordings.getRecordingDetails({ 
        recordingId: 'test-id' 
      });

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          uri: expect.stringContaining('/convergedRecordings/test-id'),
        })
      );
    });
  });

  describe('getRecordingSummary', () => {
    it('should extract suggestedNotesDownloadLink for full summary', async () => {
      const result = await recordings.getRecordingSummary({
        recordingId: 'test-id',
        summaryType: 'full',
      });

      expect(result.downloadUrl).toBeDefined();
      expect(result.summaryType).toBe('full');
    });

    it('should throw error if summary not available', async () => {
      // Mock response without suggestedNotesDownloadLink
      await expect(
        recordings.getRecordingSummary({ recordingId: 'test-id' })
      ).rejects.toThrow('Summary not available');
    });
  });

  describe('error handling', () => {
    it('should handle 404 errors', async () => {
      const mockError = new HttpResponseError({
        statusCode: 404,
        body: { message: 'Not found' },
      });
      recordings.request = jest.fn().mockRejectedValue(mockError);

      await expect(
        recordings.getRecordingDetails({ recordingId: 'invalid' })
      ).rejects.toThrow('Recording not found');
    });
  });
});
```

### 10.2 Integration Tests

```typescript
describe('Recordings Integration Tests', () => {
  let webex;

  beforeAll(async () => {
    webex = await createTestWebexInstance();
  });

  it('should list recordings', async () => {
    const result = await webex.recordings.listRecordings();
    
    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    
    if (result.items.length > 0) {
      expect(result.items[0].id).toBeDefined();
      expect(result.items[0].serviceType).toBe('calling');
    }
  });

  it('should get recording details', async () => {
    const details = await webex.recordings.getRecordingDetails({
      recordingId: TEST_RECORDING_ID,
    });
    
    expect(details.id).toBe(TEST_RECORDING_ID);
    expect(details.serviceType).toBe('calling');
    expect(details.temporaryDirectDownloadLinks).toBeDefined();
  });

  it('should retrieve download links', async () => {
    const links = await webex.recordings.getRecordingDownloadLinks({
      recordingId: TEST_RECORDING_ID,
    });
    
    expect(links.audioDownloadLink).toBeDefined();
    expect(links.expiration).toBeDefined();
  });
});
```

## 11. Plugin Registration

```typescript
// packages/@webex/webex-core/src/index.ts
import Recordings from '@webex/plugin-recordings';

// Register as a public plugin (not internal)
registerPlugin('recordings', Recordings);
```

**Key Distinction:**
- **Public plugins** (`plugin-*`): Exposed to developers via `webex.pluginName.*`
- **Internal plugins** (`internal-plugin-*`): Infrastructure and internal services via `webex.internal.pluginName.*`

The recordings plugin is public-facing, so it uses `registerPlugin()` and is accessible directly as `webex.recordings.*`.

## 12. Summary

The Recordings plugin provides a type-safe interface for accessing Webex call recordings through the Converged Recordings API. Key features:

1. **Correct API**: Uses `/v1/convergedRecordings` for call recordings
2. **List & Retrieve**: List all user recordings and get detailed info with download links
3. **Audio Focus**: Handles MP3 audio files (not video meetings)
4. **AI Features**: Provides access to AI-generated summaries, short notes, and action items
5. **Transcript Support**: Easy access to recording transcripts
6. **Type Safety**: Full TypeScript support with interfaces for all DTOs
7. **Robust Error Handling**: Meaningful error messages and retry logic
8. **Link Management**: Automatic extraction of temporary download links (3-hour expiration)
9. **Security**: Proper authentication and privacy-safe logging
10. **Consistency**: Follows existing SDK patterns and architecture

This implementation is specifically designed for **call recordings** from the Webex Calling platform, distinct from meeting recordings which use a different API.
