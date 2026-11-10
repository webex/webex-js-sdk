// TEMPORARY DEBUG: report what keeps the node process alive after the integration suite finishes.

const describeHandle = (handle) => {
  const name = handle && handle.constructor ? handle.constructor.name : typeof handle;
  const details = [];

  if (name === 'Timeout' || name === 'Immediate') {
    details.push(`idleTimeout=${handle._idleTimeout}`, `repeat=${handle._repeat}`);
    if (handle._onTimeout) {
      details.push(`fn=${handle._onTimeout.toString().slice(0, 300).replace(/\s+/g, ' ')}`);
    }
  }
  if (handle && typeof handle.remoteAddress !== 'undefined') {
    details.push(
      `remote=${handle.remoteAddress}:${handle.remotePort}`,
      `local=${handle.localAddress}:${handle.localPort}`,
      `servername=${handle.servername || (handle._host || '')}`
    );
  }
  if (handle && handle.spawnfile) {
    details.push(`pid=${handle.pid}`, `spawn=${handle.spawnargs && handle.spawnargs.join(' ')}`);
  }
  if (handle && typeof handle.fd === 'number') {
    details.push(`fd=${handle.fd}`);
  }
  if (handle && typeof handle.hasRef === 'function') {
    details.push(`hasRef=${handle.hasRef()}`);
  }

  return `${name} ${details.join(' ')}`;
};

const dumpActiveHandles = (label) => {
  /* eslint-disable no-console, no-underscore-dangle */
  const handles = process._getActiveHandles();
  const requests = process._getActiveRequests();

  console.log(`\n[active-handles] ${label}: ${handles.length} handles, ${requests.length} requests`);
  handles.forEach((handle, i) => console.log(`[active-handles]   handle ${i}: ${describeHandle(handle)}`));
  requests.forEach((req, i) => console.log(`[active-handles]   request ${i}: ${describeHandle(req)}`));
  if (typeof process.getActiveResourcesInfo === 'function') {
    console.log(`[active-handles]   resources: ${process.getActiveResourcesInfo().join(', ')}`);
  }
  /* eslint-enable no-console, no-underscore-dangle */
};

describe('zz-active-handles (debug)', () => {
  it('noop', () => {});
});

if (typeof process !== 'undefined' && typeof process._getActiveHandles === 'function') {
  after(() => {
    dumpActiveHandles('after all tests');

    [15000, 60000, 300000].forEach((delay) => {
      setTimeout(() => dumpActiveHandles(`${delay / 1000}s after all tests`), delay).unref();
    });
  });
}
