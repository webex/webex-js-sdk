/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

const DEFAULT_ASSETS_BASE_URL = '/assets/';

/**
 * Resolves and fetches binary static assets published with plugin-meetings. Requests are shared
 * between callers and cached after a successful response.
 */
export default class StaticAssetLoader {
  private readonly baseUrl: string;

  private readonly assets = new Map<string, Promise<ArrayBuffer>>();

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
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch static asset ${url}: HTTP ${response.status}`);
          }

          return response.arrayBuffer();
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
