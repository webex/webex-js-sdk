interface ILLMChannel {
  registerAndConnect: (
    locusUrl: string,
    datachannelUrl: string,
    datachannelToken?: string
  ) => Promise<void>;
  isConnected: () => boolean;
  getBinding: () => string;
  getLocusUrl: () => string;
  disconnectLLM: (options: {code: number; reason: string}) => Promise<void>;
}

export enum DataChannelTokenType {
  Default = 'default',
  PracticeSession = 'practiceSession',
}

// eslint-disable-next-line import/prefer-default-export
export type {ILLMChannel};
