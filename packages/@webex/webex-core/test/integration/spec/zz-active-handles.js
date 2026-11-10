// TEMPORARY DEBUG: report what keeps the node process alive after the integration suite finishes.

const isNode = typeof process !== 'undefined' && typeof process._getActiveHandles === 'function';

// Track creation stacks of async resources that can hold the event loop open.
const tracked = new Map();

if (isNode) {
  // eslint-disable-next-line global-require
  const asyncHooks = require('async_hooks');
  const TYPES = ['Timeout', 'TCPWRAP', 'TLSWRAP', 'PROCESSWRAP', 'PIPEWRAP', 'Immediate'];

  asyncHooks
    .createHook({
      init(asyncId, type, triggerAsyncId, resource) {
        if (TYPES.includes(type)) {
          tracked.set(asyncId, {type, resource, stack: new Error().stack.split('\n').slice(2, 14).join('\n')});
        }
      },
      destroy(asyncId) {
        tracked.delete(asyncId);
      },
    })
    .enable();
}

const describeHandle = (handle) => {
  const name = handle && handle.constructor ? handle.constructor.name : typeof handle;
  const details = [];

  if (handle && typeof handle.remoteAddress !== 'undefined') {
    details.push(
      `remote=${handle.remoteAddress}:${handle.remotePort}`,
      `servername=${handle.servername || handle._host || ''}`
    );
  }
  if (handle && handle.spawnfile) {
    details.push(`pid=${handle.pid}`, `spawn=${handle.spawnargs && handle.spawnargs.join(' ')}`);
  }
  if (handle && typeof handle.fd === 'number') {
    details.push(`fd=${handle.fd}`);
  }
  if (handle && handle._handle && typeof handle._handle.hasRef === 'function') {
    details.push(`hasRef=${handle._handle.hasRef()}`);
  }

  return `${name} ${details.join(' ')}`;
};

const dumpActiveHandles = (label) => {
  /* eslint-disable no-console, no-underscore-dangle */
  const handles = process._getActiveHandles();

  console.log(`\n[active-handles] ${label}: ${handles.length} handles`);
  handles.forEach((handle, i) => console.log(`[active-handles]   handle ${i}: ${describeHandle(handle)}`));
  if (typeof process.getActiveResourcesInfo === 'function') {
    console.log(`[active-handles]   resources: ${process.getActiveResourcesInfo().join(', ')}`);
  }

  tracked.forEach(({type, resource, stack}, asyncId) => {
    if (type === 'Timeout') {
      // eslint-disable-next-line no-underscore-dangle
      const cleared = resource._destroyed || resource._idleTimeout === -1;
      const hasRef = typeof resource.hasRef === 'function' ? resource.hasRef() : 'n/a';

      if (cleared || hasRef === false) {
        return;
      }
      console.log(
        `[active-handles]   timer ${asyncId}: hasRef=${hasRef} ms=${resource._idleTimeout} repeat=${resource._repeat}` +
          ` fn=${String(resource._onTimeout).slice(0, 200).replace(/\s+/g, ' ')}\n${stack}`
      );
    } else if (type !== 'Immediate' && type !== 'TLSWRAP') {
      const hasRef = typeof resource.hasRef === 'function' ? resource.hasRef() : 'n/a';

      if (hasRef === false) {
        return;
      }
      console.log(`[active-handles]   ${type} ${asyncId}: hasRef=${hasRef}\n${stack}`);
    }
  });
  /* eslint-enable no-console, no-underscore-dangle */
};

describe('zz-active-handles (debug)', () => {
  it('noop', () => {});
});

if (isNode) {
  after(() => {
    dumpActiveHandles('after all tests');

    [15000, 60000, 300000].forEach((delay) => {
      setTimeout(() => dumpActiveHandles(`${delay / 1000}s after all tests`), delay).unref();
    });
  });
}
