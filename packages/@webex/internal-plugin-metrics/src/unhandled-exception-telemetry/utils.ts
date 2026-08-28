/* eslint-disable require-jsdoc */

const MAX_RESOURCE_URL_LENGTH = 2_048;

export function truncate(value: string | undefined, maxLength: number): string | undefined {
  return value?.slice(0, maxLength);
}

export function removeUrlDetails(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  const withoutQueryOrFragment = value.split(/[?#]/, 1)[0];

  // Strip URL userinfo from the authority. For example,
  // https://userinfo@host/path becomes https://host/path.
  return withoutQueryOrFragment.replace(/^((?:[a-z][a-z0-9+.-]*:)?\/\/)[^/?#]*@/i, '$1');
}

// Keep HTTP(S) and relative resource URLs, remove credentials/query/fragment details, and cap them.
// For example, https://host/app.js?token=x becomes https://host/app.js, while
// data:image/svg+xml,<svg>...</svg> is rejected because its scheme is not HTTP(S).
export function sanitizeResourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  const url = value.trim();
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase();

  if (scheme && scheme !== 'http' && scheme !== 'https') {
    return undefined;
  }

  return truncate(removeUrlDetails(url), MAX_RESOURCE_URL_LENGTH);
}

export function removeUrlDetailsFromText(value: string | undefined): string | undefined {
  // Redact non-HTTP(S) schemes and strip credentials, queries, and fragments from other URLs.
  // Examples: data:text/plain,secret -> [redacted-url], https://host/api?token=x ->
  // https://host/api, api/messages?token=x -> api/messages, and GET app.js?token=x -> GET app.js.
  return (
    value
      // Handles root and dot-relative paths such as /api?token=x and ../app.js#fragment.
      // These run before the scheme matcher so query values such as x:10 are not treated as URLs.
      ?.replace(
        /(^|[\s("'=[{])((?:\/|\.\.?\/)[^\s)"'\]}]+)/g,
        (_, prefix, url) => `${prefix}${removeUrlDetails(url) ?? url}`
      )
      .replace(
        // Handles bare paths with a slash or file extension, such as api/messages?x=1 or app.js#x.
        /(^|[\s("'=[{])((?:(?:[a-z0-9._~%-]+\/)+(?:[a-z0-9._~%-]+)?|[a-z0-9._~%-]+\.[a-z0-9._~%-]+)[?#][^\s)"'\]}]+)/gi,
        (_, prefix, url) => `${prefix}${removeUrlDetails(url) ?? url}`
      )
      .replace(
        // Handles extensionless single-segment paths after an HTTP method, such as GET api?token=x.
        /\b(DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT)(\s+)([a-z0-9._~%-]+[?#][^\s)"'\]}]+)/gi,
        (_, method, spacing, url) => `${method}${spacing}${removeUrlDetails(url) ?? url}`
      )
      .replace(
        // Handles URLs with a scheme, including assigned values such as url=https://host/path?x=1.
        // HTTP(S) details are stripped; data:, blob:, and other schemes are fully redacted.
        /(^|[\s("'=[{,;])(([a-z][a-z0-9+.-]*):[^\s)"'\]}]+)/gi,
        (_, prefix, url, scheme) =>
          `${prefix}${
            ['http', 'https'].includes(scheme.toLowerCase())
              ? removeUrlDetails(url) ?? url
              : '[redacted-url]'
          }`
      )
  );
}

export function createFingerprint(value: string): string {
  // DJB2-style hash: multiply by 33, add each UTF-16 code unit, and constrain the result to 32 bits.
  // It provides a small stable deduplication key; it is not intended for cryptographic use.
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 4_294_967_296;
  }

  return hash.toString(16).padStart(8, '0');
}

export function stringifyReason(reason: unknown): string {
  if (typeof reason === 'string') {
    return reason;
  }

  try {
    return JSON.stringify(reason) ?? String(reason);
  } catch {
    try {
      return String(reason);
    } catch {
      return 'Unserializable rejection reason';
    }
  }
}
