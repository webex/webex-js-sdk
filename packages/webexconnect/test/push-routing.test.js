/**
 * UA-routing tests for the push registration path selection in IMIClient.js.
 *
 * IMIClient.js is a large browser IIFE that cannot be `require`d directly under
 * Node, so we load it into a sandboxed VM context with stubbed browser globals
 * and then exercise the REAL functions it defines:
 *   - IMI.getBrowserName()      (UA -> normalized browser name)
 *   - IMI._resolvePushPath()    ("fcm" | "safari" | "none")
 *   - IMI._isIOSWeb()           (capability-based iOS/iPadOS detection)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCE = fs.readFileSync(path.resolve(__dirname, '../src/IMIClient.js'), 'utf8');

// Real-world User-Agent strings for the platforms we route on.
const UA = {
  iosSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  criOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  // iPadOS 13+ "desktop mode" reports a macOS desktop UA (indistinguishable from a Mac by UA alone).
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

// Load IMIClient.js into a fresh sandbox and return its context.
function loadIMI() {
  const sandbox = {
    navigator: {
      userAgent: '',
      appName: 'Netscape',
      appVersion: '5.0',
      maxTouchPoints: 0,
      language: 'en-US',
    },
    window: {},
    document: {
      head: {childNodes: []},
      createElement: () => ({}),
      getElementsByTagName: () => [{appendChild() {}}],
    },
    self: {},
    console: {log() {}, debug() {}, error() {}, warn() {}, info() {}},
    location: {href: 'http://127.0.0.1/', protocol: 'http:', origin: 'http://127.0.0.1'},
    firebase: undefined,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
  };

  sandbox.globalThis = sandbox;
  sandbox.window.navigator = sandbox.navigator;

  const context = vm.createContext(sandbox);

  try {
    vm.runInContext(SOURCE, context, {filename: 'IMIClient.js'});
  } catch (e) {
    // Later top-level browser code may reference globals we didn't stub; the base
    // IMI object (with the functions under test) is the first statement in the
    // file, so it is already defined by then.
  }

  return context;
}

// Point the sandbox at a given browser environment, then report how the SDK
// would route push registration for it (UA -> browserName -> push path).
function routeFor(context, env) {
  context.navigator.userAgent = env.userAgent;
  context.navigator.maxTouchPoints = env.maxTouchPoints || 0;
  context.window.MSStream = env.hasMSStream ? {} : undefined;
  context.window.safari = env.safariPushAvailable ? {pushNotification: {}} : undefined;
  context.firebase = env.firebase; // undefined => FCM support "unknown" => treated as supported

  const browserName = context.IMI.getBrowserName();

  return {
    browserName,
    isIOSWeb: context.IMI._isIOSWeb(),
    path: context.IMI._resolvePushPath(browserName),
  };
}

describe('@webex/webexconnect push routing', () => {
  let context;

  beforeAll(() => {
    context = loadIMI();
  });

  test('exposes the routing helpers under test', () => {
    expect(context.IMI).toBeDefined();
    expect(typeof context.IMI.getBrowserName).toBe('function');
    expect(typeof context.IMI._isIOSWeb).toBe('function');
    expect(typeof context.IMI._resolvePushPath).toBe('function');
  });

  describe.each([
    [
      'iOS Safari -> none',
      {userAgent: UA.iosSafari, maxTouchPoints: 5},
      {browserName: 'safari', isIOSWeb: true, path: 'none'},
    ],
    [
      'iOS Chrome (CriOS) -> none (no FCM on iOS)',
      {userAgent: UA.criOS, maxTouchPoints: 5},
      {browserName: 'chrome', isIOSWeb: true, path: 'none'},
    ],
    [
      'iPadOS desktop mode (Macintosh UA + touch) -> none',
      {userAgent: UA.macSafari, maxTouchPoints: 5, safariPushAvailable: true},
      {browserName: 'safari', isIOSWeb: true, path: 'none'},
    ],
    [
      'macOS Safari (with push API) -> safari',
      {userAgent: UA.macSafari, maxTouchPoints: 0, safariPushAvailable: true},
      {browserName: 'safari', isIOSWeb: false, path: 'safari'},
    ],
    [
      'macOS Safari (no push API) -> none',
      {userAgent: UA.macSafari, maxTouchPoints: 0, safariPushAvailable: false},
      {browserName: 'safari', isIOSWeb: false, path: 'none'},
    ],
    [
      'desktop Chrome -> fcm',
      {userAgent: UA.desktopChrome, maxTouchPoints: 0},
      {browserName: 'chrome', isIOSWeb: false, path: 'fcm'},
    ],
  ])('%s', (name, env, expected) => {
    test('routes as expected', () => {
      expect(routeFor(context, env)).toEqual(expected);
    });
  });
});
