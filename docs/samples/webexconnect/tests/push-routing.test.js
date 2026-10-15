"use strict";

/**
 * UA-routing tests for the push registration path selection in IMIClient.js.
 *
 * IMIClient.js is a large browser IIFE that cannot be `require`d directly under
 * Node, so we load it into a sandboxed VM context with stubbed browser globals
 * and then exercise the REAL functions it defines:
 *   - IMI.getBrowserName()      (UA -> normalized browser name)
 *   - IMI._resolvePushPath()    ("fcm" | "safari" | "none")
 *   - IMI._isIOSWeb()           (capability-based iOS/iPadOS detection)
 *
 * The base `IMI` object literal (which contains these functions) is the very
 * first statement in the file, so even if later top-level browser code throws
 * while loading, `context.IMI` is already populated - we tolerate that.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Canonical source of truth — the sample no longer vendors its own IMIClient.js.
const IMICLIENT_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "packages",
  "webexconnect",
  "src",
  "IMIClient.js"
);
const SOURCE = fs.readFileSync(IMICLIENT_PATH, "utf8");

// Real-world User-Agent strings for the platforms called out in the PR review.
const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  criOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  // iPadOS 13+ "desktop mode" reports a macOS desktop UA (indistinguishable from a Mac by UA alone).
  iPadOSDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

// Load IMIClient.js once into a fresh sandbox and return its IMI object.
function loadIMI() {
  const sandbox = {
    navigator: { userAgent: "", appName: "Netscape", appVersion: "5.0", maxTouchPoints: 0, language: "en-US" },
    window: {},
    document: { head: { childNodes: [] }, createElement: () => ({}), getElementsByTagName: () => [{ appendChild() {} }] },
    self: {},
    console: { log() {}, debug() {}, error() {}, warn() {}, info() {} },
    location: { href: "http://127.0.0.1/", protocol: "http:", origin: "http://127.0.0.1" },
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
    vm.runInContext(SOURCE, context, { filename: "IMIClient.js" });
  } catch (e) {
    // Later top-level browser code may reference globals we didn't stub; the base
    // IMI object (with the functions under test) is already defined by then.
  }
  assert.ok(context.IMI, "IMI namespace should be defined after loading IMIClient.js");
  assert.equal(typeof context.IMI._resolvePushPath, "function", "_resolvePushPath should exist");
  assert.equal(typeof context.IMI.getBrowserName, "function", "getBrowserName should exist");
  return context;
}

// Configure the sandbox to emulate a given browser environment, then return the
// routing path the SDK would take for it (UA -> browserName -> push path).
function routeFor(context, env) {
  context.navigator.userAgent = env.userAgent;
  context.navigator.maxTouchPoints = env.maxTouchPoints || 0;
  context.window.MSStream = env.hasMSStream ? {} : undefined;
  context.window.safari = env.safariPushAvailable ? { pushNotification: {} } : undefined;
  context.firebase = env.firebase; // undefined => FCM support "unknown" => treated as supported
  const browserName = context.IMI.getBrowserName();
  return { browserName: browserName, path: context.IMI._resolvePushPath(browserName) };
}

test("UA routing (IMIClient.js)", async (t) => {
  const context = loadIMI();

  await t.test("iOS Safari -> none", () => {
    const r = routeFor(context, { userAgent: UA.iosSafari, maxTouchPoints: 5 });
    assert.equal(r.browserName, "safari");
    assert.equal(r.path, "none");
  });

  await t.test("iOS Chrome (CriOS) -> none (no FCM on iOS)", () => {
    const r = routeFor(context, { userAgent: UA.criOS, maxTouchPoints: 5 });
    assert.equal(r.browserName, "chrome");
    assert.equal(r.path, "none");
  });

  await t.test("iPadOS desktop mode (Macintosh UA + touch) -> none", () => {
    const r = routeFor(context, { userAgent: UA.iPadOSDesktop, maxTouchPoints: 5, safariPushAvailable: true });
    assert.equal(r.browserName, "safari");
    assert.equal(context.IMI._isIOSWeb(), true);
    assert.equal(r.path, "none");
  });

  await t.test("macOS Safari (with push API) -> safari", () => {
    const r = routeFor(context, { userAgent: UA.macSafari, maxTouchPoints: 0, safariPushAvailable: true });
    assert.equal(r.browserName, "safari");
    assert.equal(context.IMI._isIOSWeb(), false);
    assert.equal(r.path, "safari");
  });

  await t.test("macOS Safari (no push API) -> none", () => {
    const r = routeFor(context, { userAgent: UA.macSafari, maxTouchPoints: 0, safariPushAvailable: false });
    assert.equal(r.path, "none");
  });

  await t.test("desktop Chrome -> fcm", () => {
    const r = routeFor(context, { userAgent: UA.desktopChrome, maxTouchPoints: 0 });
    assert.equal(r.browserName, "chrome");
    assert.equal(r.path, "fcm");
  });
});
