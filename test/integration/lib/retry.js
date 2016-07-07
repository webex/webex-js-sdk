'use strict';

function retry(fn) {
  return [0, 1000, 2000, 4000].reduce(function(promise, timeout) {
    return promise.catch(function() {
      return new Promise(function(resolve) {
        setTimeout(function() {
          resolve(fn());
        }, timeout);
      });
    });
  }, Promise.reject());
}

module.exports = retry;
