import type {WebexRequestMethod} from './types';

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
  private readonly webexRequest: WebexRequestMethod;

  private readonly baseUrl: string;

  private readonly assets = new Map<string, Promise<ArrayBuffer>>();

  /**
   * @param {Object} deps
   * @param {WebexRequestMethod} deps.webexRequest - The (bound) webex.request method.
   * @param {string} [deps.baseUrl='/assets/'] - Base URL for plugin-meetings static assets.
   */
  constructor({
    webexRequest,
    baseUrl = DEFAULT_ASSETS_BASE_URL,
  }: {
    webexRequest: WebexRequestMethod;
    baseUrl?: string;
  }) {
    this.webexRequest = webexRequest;
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
      asset = this.webexRequest({method: 'GET', uri: url, responseType: 'buffer'})
        .then((response) => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new Error(`Failed to fetch static asset ${url}: HTTP ${response.statusCode}`);
          }

          const contentType = (
            response.headers?.['content-type'] ?? response.headers?.['Content-Type']
          )
            ?.split(';')[0]
            .trim()
            .toLowerCase();

          if (contentType === 'text/html' || contentType === 'application/xhtml+xml') {
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
            throw new Error(
              `Failed to fetch static asset ${url}: response body is not binary data`
            );
          }

          // Some static servers return an HTML fallback page with a successful status and a
          // generic binary content type. Reject it before callers pass those bytes to the calling
          // modules that expect binary data, such as WASM.
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
