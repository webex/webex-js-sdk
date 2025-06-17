export interface RequestResult {
  resultArray: any[];
  error: string | null;
}

export interface RequestOptions {
  resource: string;
  dataPath: string;
  foundPath?: string;
  notFoundPath?: string;
  params?: Record<string, unknown>;
}

export interface SummarizeMeetingOptions {
  meetingInstanceId: string;
  meetingSite: string;
  sessionId: string;
  encryptionKeyUrl: string;
}
