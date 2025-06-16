export interface RequestResult {
  foundArray?: any[];
  notFoundArray?: any[];
  resultArray: any[];
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
}
