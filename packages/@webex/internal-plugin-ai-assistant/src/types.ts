export interface RequestResponse {
  sessionId: string;
  requestId: string;
  streamEventName: string;
  id: string;
  url: string;
  sessionUrl: string;
  creatorId: string;
  createdAt: string;
}

export interface StreamEvent {
  message: string;
  requestId: string;
  finished: boolean;
  error: string | null;
}

export interface RequestOptions {
  resource: string;
  dataPath: string;
  foundPath?: string;
  notFoundPath?: string;
  params?: Record<string, unknown>;
  requestId?: string;
}

export interface ContextResource {
  id: string;
  type: string;
  url: string;
}

export interface SummarizeMeetingOptions {
  assistant?: string;
  meetingInstanceId: string;
  meetingSite: string;
  sessionId: string;
  encryptionKeyUrl: string;
  lastMinutes?: number;
  requestId?: string;
}

export interface AiAssistantRequestOptions {
  sessionId: string;
  encryptionKeyUrl: string;
  contextResources: ContextResource[];
  contentType: 'action' | 'message';
  contentValue: string;
  parameters?: any;
  assistant?: string;
  locale?: string;
  requestId?: string;
  entryPoint?: string;
}
