/* eslint-disable @typescript-eslint/no-explicit-any */
import workerScript from '../../../../../../src/services/core/websocket/keepalive.worker';

describe('keepalive worker script', () => {
  it('omits console logging', () => {
    expect(workerScript).not.toMatch(/console\./);
  });

  it('still defines the keepalive control flow', () => {
    expect(workerScript).toMatch(/checkOnlineStatus/);
    expect(workerScript).toMatch(/checkNetworkStatus/);
    expect(workerScript).toMatch(/addEventListener\("message"/);
    expect(workerScript).toMatch(/self\.addEventListener\('online'/);
    expect(workerScript).toMatch(/self\.addEventListener\('offline'/);
    expect(workerScript).toMatch(/postMessage\(\{ type: "keepalive", onlineStatus \}\)/);
    expect(workerScript).toMatch(/postMessage\(\{ type: "closeSocket" \}\)/);
  });
});
