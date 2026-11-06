/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

// @ts-ignore
import StatelessWebexPlugin from './stateless-webex-plugin';
import addAssetDiagnostics from './static-asset-diagnostics';

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
 * Resolves and downloads static assets for SDK plugins. Requests are shared between callers and
 * cached after a successful response.
 *
 * IMPORTANT: When adding assets, ensure that their names are unique and versioned to avoid caching issues.
 *   Example: 'e2ee-0.0.1.wasm' instead of 'e2ee.wasm'
 *   or use content-based hashing in the filename to ensure uniqueness.
 */
export default class StaticAssetLoader extends StatelessWebexPlugin {
  private readonly baseUrl: string;

  private readonly assets = new Map<string, Promise<ArrayBuffer>>();

  /**
   * @param {Object} attrs
   * @param {string} attrs.baseUrl - Base URL for the plugin's static assets.
   * @param {Object} options
   * @param {Object} [options.parent] - The parent Webex SDK instance.
   */
  constructor(attrs: {baseUrl: string}, options: {parent?: any} = {}) {
    super(attrs, options);
    this.baseUrl = attrs.baseUrl.replace(/\/+$/, ''); // remove trailing slashes
  }

  /**
   * Returns the URL for an asset in the configured asset directory.
   * @param {string} assetName
   * @returns {string}
   */
  getUrl(assetName: string): string {
    return `${this.baseUrl}/${assetName.replace(/^\/+/, '')}`; // regex removes leading slashes from the asset name
  }

  /**
   * Downloads an asset as bytes. Failed requests are evicted so a later call can retry.
   * @param {string} assetName
   * @returns {Promise<Uint8Array>}
   */
  async getBytes(assetName: string): Promise<Uint8Array> {
    const url = this.getUrl(assetName);
    let asset = this.assets.get(url);

    if (!asset) {
      const startedAt = new Date().getTime();
      let assetResponse: Parameters<typeof addAssetDiagnostics>[1];
      let failureKind: Parameters<typeof addAssetDiagnostics>[3] = 'network';

      // @ts-ignore - StatelessWebexPlugin exposes request from the parent Webex instance.
      asset = this.request({
        method: 'GET',
        uri: url,
        responseType: 'buffer',
        // Assets may be hosted on a third-party CDN: never send the user's token, and suppress
        // the SDK's custom headers so the request doesn't trigger a CORS preflight.
        addAuthHeader: false,
        headers: {
          trackingid: null,
          'spark-user-agent': null,
          'cisco-no-http-redirect': null,
        },
      })
        .then((response: any) => {
          assetResponse = response;
          failureKind = 'http';
          if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new Error(`Failed to fetch static asset ${url}: HTTP ${response.statusCode}`);
          }

          const contentType = response.headers?.['content-type']
            ?.split(';')[0]
            .trim()
            .toLowerCase();

          if (contentType === 'text/html' || contentType === 'application/xhtml+xml') {
            failureKind = 'html';
            throw new Error(
              `Failed to fetch static asset ${url}: unexpected HTML content type "${contentType}"`
            );
          }

          const responseBody = response.body;
          let buffer: ArrayBuffer;

          if (responseBody instanceof ArrayBuffer) {
            buffer = responseBody;
          } else if (ArrayBuffer.isView(responseBody)) {
            buffer = responseBody.buffer.slice(
              responseBody.byteOffset,
              responseBody.byteOffset + responseBody.byteLength
            ) as ArrayBuffer;
          } else {
            failureKind = 'invalid-body';
            throw new Error(
              `Failed to fetch static asset ${url}: response body is not binary data`
            );
          }

          // Some static servers return an HTML fallback page with a successful status and a
          // generic binary content type. Reject it before callers pass those bytes to modules
          // that expect binary data, such as WASM.
          if (looksLikeHtmlDocument(buffer)) {
            failureKind = 'html';
            throw new Error(
              `Failed to fetch static asset ${url}: response body looks like an HTML document`
            );
          }

          return buffer;
        })
        .catch((error: Error) => {
          this.assets.delete(url);
          throw addAssetDiagnostics(error, assetResponse, startedAt, failureKind);
        });
      this.assets.set(url, asset);
    }

    return new Uint8Array((await asset).slice(0));
  }
}
