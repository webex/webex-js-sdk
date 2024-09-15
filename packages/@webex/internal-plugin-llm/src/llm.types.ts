interface ILLMChannel {
  registerAndConnect: (locusUrl: string, datachannelUrl: string) => Promise<void>;
  registerWithBodyAndConnect: (datachannelUrl: string, body: object) => Promise<void>;
  isConnected: () => boolean;
  getBinding: () => string;
  getLocusUrl: () => string;
  disconnectLLM: () => Promise<void>;
}
// eslint-disable-next-line import/prefer-default-export
export type {ILLMChannel};
