/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

const DEFAULT_ASSETS_BASE_URL = '/assets/';

/**
 * Detects an HTML document prefix in an otherwise successful binary asset response.
 * @param {ArrayBuffer} buffer
 * @returns {boolean}
 */
function looksLikeHtmlDocument(buffer: ArrayBuffer): boolean {
  const prefix = new TextDecoder().decode(buffer.slice(0, 256)).trimStart();

  return prefix.startsWith('<');
}

/**
 * Resolves and fetches binary static assets published with plugin-meetings. Requests are shared
 * between callers and cached after a successful response.
 */
export default class StaticAssetLoader {
  private readonly baseUrl: string;

  private readonly assets = new Map<string, Promise<ArrayBuffer>>();

  /**
   * @param {string} [baseUrl='/assets/'] - Base URL for plugin-meetings static assets.
   */
  constructor(baseUrl = DEFAULT_ASSETS_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Returns the URL for an asset in the configured asset directory.
   * @param {string} assetName
   * @returns {string}
   */
  getUrl(assetName: string): string {
    return `${this.baseUrl}/${assetName.replace(/^\/+/, '')}`;
  }

  /**
   * Fetches an asset as bytes. Failed requests are evicted so a later call can retry.
   * @param {string} assetName
   * @returns {Promise<Uint8Array>}
   */
  async getBytes(assetName: string): Promise<Uint8Array> {
    const url = this.getUrl(assetName);
    let asset = this.assets.get(url);

    if (!asset) {
      asset = fetch(url)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch static asset ${url}: HTTP ${response.status}`);
          }

          const contentType = response.headers
            .get('content-type')
            ?.split(';')[0]
            .trim()
            .toLowerCase();

          if (contentType === 'text/html' || contentType === 'application/xhtml+xml') {
            throw new Error(
              `Failed to fetch static asset ${url}: unexpected HTML content type "${contentType}"`
            );
          }

          const buffer = await response.arrayBuffer();

          // Some static servers return an HTML fallback page with a successful status and a
          // generic binary content type. Reject it before callers pass those bytes to WASM.
          if (looksLikeHtmlDocument(buffer)) {
            throw new Error(
              `Failed to fetch static asset ${url}: response body looks like an HTML document`
            );
          }

          return buffer;
        })
        .catch((error) => {
          this.assets.delete(url);
          throw error;
        });
      this.assets.set(url, asset);
    }

    return new Uint8Array((await asset).slice(0));
  }
}
