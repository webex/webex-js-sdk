/**
 * @file webrtc-adapter-adapter
 * Yep, you read that filename right. There seems to be a bug in adapter.js that
 * doesn't quite clean up everythings it supposed to. This is an adapter for the
 * adapter that makes sure it removes the correct streams from the
 * PeerConnection's caches
 */

if (!process.env.NO_WEBRTC_ADAPTER) {
  try {
    // eslint-disable-next-line global-require
    require('webrtc-adapter');
  }
  catch (err) {
    // eslint-disable-next-line no-console
    console[process.env.NODE_ENV === 'production' ? 'info' : 'warn']('Failed to apply adapter.js. Are we running in an environment that disallows altering globals?', err);
  }
}
