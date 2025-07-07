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

global.URL = {
  createObjectURL: jest.fn(() => 'mocked-blob-url'),
  revokeObjectURL: jest.fn(),
};

// Add Blob mocking if needed
global.Blob = class {
  constructor(content, options) {
    this.content = content;
    this.options = options;
    this.size = content ? content.reduce((acc, item) => acc + item.length, 0) : 0;
    this.type = options?.type || '';
  }
};
