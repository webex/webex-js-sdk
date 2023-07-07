/* eslint-disable import/prefer-default-export */
import {EventEmitter} from 'events';
import Interceptor from '../lib/interceptor';

/**
 * @param {Object} options
 * @param {Array<Object>} interceptors
 * @param {string} key
 * @param {Object | undefined} res
 * @private
 * @returns {Promise}
 */
export function intercept(
  options: object,
  interceptors: Array<Interceptor>,
  key: string,
  res: object = undefined
): Promise<any> {
  const successKey = `on${key}`;
  const errorKey = `on${key}Error`;

  return interceptors.reduce(
    (promise, interceptor) =>
      promise.then(
        (result) => {
          interceptor.logOptions(options);
          if (interceptor[successKey]) {
            return interceptor[successKey](options, result);
          }

          return Promise.resolve(result);
        },
        (reason) => {
          interceptor.logOptions(options);
          if (interceptor[errorKey]) {
            return interceptor[errorKey](options, reason);
          }

          return Promise.reject(reason);
        }
      ),
    Promise.resolve(res)
  );
}

/**
 * Prepare options for a fetch.
 * @param {object} options
 * @returns {Promise}
 */
export async function prepareFetchOptions(options: any): Promise<any> {
  if (options.url) {
    options.uri = options.url;
    options.url = null;
  }

  options.headers = options.headers || {};

  options.download = new EventEmitter();
  options.upload = new EventEmitter();

  return intercept(options, options.interceptors, 'Request').then(() => options);
}
