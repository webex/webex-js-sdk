/**
 * A lot of failures get produced by EventEmitters, which makes them difficult to
 * detect in tests (they just look like timeouts). This is a test helper that
 * captures that error and turns it into a rejected promise
 * @param {Call} call
 * @param {Function} fn
 * @returns {Promise}
 */
export default function handleErrorEvent(call, fn) {
  let r;
  const p = new Promise((resolve, reject) => {
    r = reject;
    call.on(`error`, reject);
  });

  return Promise.race([p, fn()])
    .then(unbind)
    .catch((reason) => {
      unbind();
      throw reason;
    });

  function unbind() {
    try {
      call.off(`error`, r);
    }
    catch (err) {
      // ignore
    }
  }
}
