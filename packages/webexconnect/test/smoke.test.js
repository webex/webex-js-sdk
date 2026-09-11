/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

describe('@webex/webexconnect build output', () => {
  beforeAll(() => {
    const bundle = fs.readFileSync(
      path.resolve(__dirname, '../dist/webex-connect-sdk.min.js'),
      'utf8'
    );
    // eslint-disable-next-line no-eval
    eval(bundle);
  });

  test('exposes the IMI global', () => {
    expect(window.IMI).toBeDefined();
  });

  test('exposes the core public constructors', () => {
    expect(window.IMI.ICConfig).toBeInstanceOf(Function);
    expect(window.IMI.ICMessage).toBeInstanceOf(Function);
    expect(window.IMI.ICDeviceProfile).toBeInstanceOf(Function);
    expect(window.IMI.IMIconnect).toBeDefined();
  });
});
