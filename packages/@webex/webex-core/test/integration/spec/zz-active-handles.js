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

// Tag every webex instance with the spec location that created it, and once all tests have
// finished, log every batcher request/flush so we can see which instance keeps the loop alive.
let currentTest = '(before any test)';
let instanceCounter = 0;
let tracingBatchers = false;
let batcherLogCount = 0;
const MAX_BATCHER_LOGS = 40;

const specFrames = (stack) =>
  stack
    .split('\n')
    .filter((line) => line.includes('/test/integration/spec/') && !line.includes('zz-active-handles'))
    .slice(0, 3)
    .map((line) => line.trim())
    .join(' <- ');

const describeWebex = (webex) => {
  if (!webex) {
    return 'webex=<none>';
  }
  const services = webex.internal && webex.internal.services;
  let servicesInfo = 'services=<none>';

  if (services) {
    let metricsUrl;
    let catalogInfo = '';

    try {
      metricsUrl = services.get('metrics');
    } catch (e) {
      metricsUrl = `<error ${e.message}>`;
    }
    try {
      const catalog = services._getCatalog();
      const groups = catalog.serviceGroups || {};

      catalogInfo = ` isReady=${catalog.isReady} groups=${Object.keys(groups)
        .map((g) => `${g}:${(groups[g] || []).length}`)
        .join(',')}`;
    } catch (e) {
      catalogInfo = ` catalog=<error ${e.message}>`;
    }
    const impl = typeof services.switchActiveClusterIds === 'function' ? 'ServicesV2' : 'Services';

    servicesInfo = `services=${impl} metricsUrl=${metricsUrl}${catalogInfo}`;
  }

  return `webex=${webex.__debugTag || '<untagged>'} authed=${
    webex.credentials && webex.credentials.canAuthorize
  } ${servicesInfo}`;
};

if (isNode) {
  // eslint-disable-next-line global-require
  const webexCore = require('@webex/webex-core');
  const WebexCore = webexCore.default;
  const {Batcher} = webexCore;

  const originalInitialize = WebexCore.prototype.initialize;

  WebexCore.prototype.initialize = function initialize(...args) {
    instanceCounter += 1;
    this.__debugTag = `#${instanceCounter} [test: ${currentTest}] [at: ${specFrames(new Error().stack)}]`;

    return Reflect.apply(originalInitialize, this, args);
  };

  const logBatcher = (batcher, what) => {
    if (!tracingBatchers || batcherLogCount >= MAX_BATCHER_LOGS) {
      return;
    }
    batcherLogCount += 1;
    // eslint-disable-next-line no-console
    console.log(
      `[batcher-loop] ${batcher.constructor && batcher.constructor.name}/${batcher.namespace} ${what}\n` +
        `[batcher-loop]   ${describeWebex(batcher.webex)}`
    );
  };

  const originalRequest = Batcher.prototype.request;

  Batcher.prototype.request = function request(item) {
    logBatcher(this, `request item=${JSON.stringify(item).slice(0, 500)}`);

    return Reflect.apply(originalRequest, this, [item]);
  };

  const originalExecuteQueue = Batcher.prototype.executeQueue;

  Batcher.prototype.executeQueue = function executeQueue(...args) {
    logBatcher(this, `executeQueue queueLength=${this.queue.length}`);

    return Reflect.apply(originalExecuteQueue, this, args);
  };

  beforeEach(function setCurrentTest() {
    currentTest = this.currentTest ? this.currentTest.fullTitle() : '(unknown)';
  });
}

describe('zz-active-handles (debug)', () => {
  it('noop', () => {});
});

if (isNode) {
  after(() => {
    dumpActiveHandles('after all tests');
    tracingBatchers = true;

    [15000, 60000, 300000].forEach((delay) => {
      setTimeout(() => dumpActiveHandles(`${delay / 1000}s after all tests`), delay).unref();
    });
  });
}
