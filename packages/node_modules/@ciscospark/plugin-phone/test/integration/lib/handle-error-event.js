/**
 * A lot of failures get produced by EventEmitters, which makes them difficult to
 * detect in tests (they just look like timeouts). This is a test helper that
 * captures that error and turns it into a rejected promise
 * @param {EventEmitter} emitter
 * @param {Function} fn
 * @returns {Promise}
 */
export default function handleErrorEvent(emitter, fn) {
  let r;
  const p = new Promise((resolve, reject) => {
    r = reject;
    emitter.once(`error`, reject);
  });

  const handler = Promise.race([p, fn(emitter)])
    .then(unbind)
    .catch((reason) => {
      unbind();
      throw reason;
    });

  // Make it possible to add additional emitters
  handler.add = (e) => e.once(`error`, r);

  return handler;

  function unbind() {
    try {
      emitter.off(`error`, r);
    }
    catch (err) {
      // ignore
    }
  }
}
