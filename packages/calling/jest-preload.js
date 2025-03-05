/* To debug something while using jest , use console.debug() as this is not mocked */
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  trace: jest.fn(),
};

global.Worker = class {
  onmessage = jest.fn();

  onerror = jest.fn();

  postMessage() {}

  terminate() {}
};

jest.mock('./src/common/webWorkerUtils', () => {
  return {
    getWorkerURL: (relativePath) => {
      const fallbackUrl = 'http://test.url/mockWebWorker.ts';

      return new URL(relativePath, fallbackUrl);
    },
  };
});
