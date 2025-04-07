import {BASE_URL} from './webWorkerConstant';
/**
 * Constructs a `URL` object for a given relative path and base URL.
 *
 * @param relativePath - The relative path to the resource.
 * @returns A `URL` object representing the resolved URL.
 */

export function getWorkerURL(relativePath: string): URL {
  return new URL(relativePath, BASE_URL);
}
