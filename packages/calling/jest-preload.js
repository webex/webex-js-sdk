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

jest.mock('./src/common/webWorkerConstant', () => ({
  BASE_URL: 'https://example.com/some/path/module.js',
}));
