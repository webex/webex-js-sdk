const retryErrors = [429, 502, 503, 504];

async function requestWithRetries(ctx, func, args, retryCount = 0, retryIntervalInSeconds = 0, maxRetries = 3) {
  await timeout(retryIntervalInSeconds);

  return func.apply(ctx, args)
    .catch((reason) => {
      if (retryErrors.includes(reason.statusCode) && retryCount < maxRetries) {
        retryCount += 1;
        let retryIntervalInSeconds = (retryCount + 1) ** 2; // 4, 9 and 16 second delays as default

        if (reason.headers && reason.headers['retry-after']) {
          retryIntervalInSeconds = reason.headers['retry-after'];
        }
        console.error(`Request #${retryCount} error: ${reason.statusCode}. Attempting retry #${retryCount} in ${retryIntervalInSeconds} seconds`);

        return requestWithRetries(ctx, func, args, retryCount, retryIntervalInSeconds, maxRetries);
      }

      return Promise.reject(reason);
    });
}

function timeout(sec) {
  // return immediately if timeout is zero or undefined
  if (!sec) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, sec * 1000));
}

module.exports.requestWithRetries = requestWithRetries;
module.exports.timeout = timeout;
