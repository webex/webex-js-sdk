/*!
 * web-extension-bridge sample service worker.
 *
 * Classic worker, so the bundled SDK is pulled in with importScripts and the manifest
 * needs no "type": "module". Everything below runs at the top level: an MV3 worker is
 * evicted when idle, and only listeners registered synchronously can revive it.
 */

/* global WebExtensionBridgeBackground */

importScripts('./vendor/web-extension-bridge-background.js');

/**
 * The manifest is the single source of truth for which origins this extension talks to.
 * Deriving the runtime allow-list from it means the two can never drift apart.
 *
 * @returns {string[]} Exact origins taken from the content-script match patterns.
 */
function allowedOriginsFromManifest() {
  var manifest = chrome.runtime.getManifest();
  var scripts = manifest.content_scripts || [];
  var origins = [];

  scripts.forEach(function collect(entry) {
    (entry.matches || []).forEach(function addOrigin(match) {
      var origin = match.replace(/\/\*$/, '');

      if (origins.indexOf(origin) === -1) {
        origins.push(origin);
      }
    });
  });

  return origins;
}

var bridge = WebExtensionBridgeBackground.createExtensionBridge({
  allowedOrigins: allowedOriginsFromManifest(),
});

// Debug affordance for whoever is testing this: open the service worker's console from
// chrome://extensions and drive the bridge by hand, for example
// `await bridgeSample.bridge.request('snapshot')` or `await bridgeSample.bridge.listConnections()`.
// The worker global is not reachable from the page, so this exposes nothing to it.
self.bridgeSample = {bridge: bridge};

// FR8: pushes that arrive while no popup is open are buffered by the bridge. The badge
// is how this sample makes that visible without keeping a page open.
var unread = 0;

bridge.subscribe(function onPush(topic) {
  unread += 1;
  chrome.action.setBadgeBackgroundColor({color: '#0b5cff'});
  chrome.action.setBadgeText({text: String(Math.min(unread, 99))});
  console.info('[sample] push received on topic', topic);
});

chrome.runtime.onMessage.addListener(function onSampleMessage(message, sender, sendResponse) {
  // The SDK owns its own command protocol; this is the sample's own one-off message,
  // and like the SDK it refuses anything that did not come from this extension's pages.
  if (
    sender.id !== chrome.runtime.id ||
    sender.tab !== undefined ||
    !message ||
    message.sample !== 'clear-badge'
  ) {
    return false;
  }

  unread = 0;
  chrome.action.setBadgeText({text: ''});
  sendResponse({ok: true});

  return false;
});

chrome.runtime.onInstalled.addListener(function onInstalled() {
  console.info('[sample] bridge ready for', allowedOriginsFromManifest().join(', '));
});
