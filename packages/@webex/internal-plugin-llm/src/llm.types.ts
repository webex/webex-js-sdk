interface ILLMChannel {
  registerAndConnect: (locusUrl: string, datachannelUrl: string) => Promise<void>;
  isConnected: () => boolean;
  getBinding: () => string;
  getLocusUrl: () => string;
  disconnectLLM: (options: {code: number; reason: string}) => Promise<void>;
}
// eslint-disable-next-line import/prefer-default-export
export type {ILLMChannel};
