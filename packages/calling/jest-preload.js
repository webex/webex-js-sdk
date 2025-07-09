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

const OriginalURL = global.URL || URL;

global.URL = jest.fn().mockImplementation((url, base) => {
  // Use the actual URL constructor for normal URL operations
  return new OriginalURL(url, base);
});

// Add the static methods you need for blob handling
global.URL.createObjectURL = jest.fn(() => 'mocked-blob-url');
global.URL.revokeObjectURL = jest.fn();

global.Blob = class {
  constructor(content, options) {
    this.content = content;
    this.options = options;
    this.size = content ? content.reduce((acc, item) => acc + item.length, 0) : 0;
    this.type = options?.type || '';
  }
};
