import type {ChromeTabChangeInfo} from './platform';

/** A {@link ChromeTabChangeInfo} known to carry a new url. */
export type UrlChange = ChromeTabChangeInfo & {url: string};

/**
 * @param changeInfo - What Chrome reported changed about a tab.
 * @returns Whether the tab has begun loading a *new document*, which replaces the page
 *   context a connection was established in.
 *
 * This is the signal that separates a reload or a followed link from a route change:
 * a same-document navigation never puts the tab into the loading state, so `status`
 * is the discriminator and a bare url change is not one.
 */
export function isLoadingNewDocument(changeInfo: ChromeTabChangeInfo): boolean {
  return changeInfo.status === 'loading';
}

/**
 * @param changeInfo - What Chrome reported changed about a tab.
 * @returns Whether the update carries a new url to interpret.
 */
export function hasUrlChange(changeInfo: ChromeTabChangeInfo): changeInfo is UrlChange {
  return typeof changeInfo.url === 'string';
}

/**
 * @param url - Url Chrome reported for a tab.
 * @returns The url's origin, or `undefined` when it cannot be parsed.
 *
 * Deliberately not allow-list checked: callers compare the result against the origin
 * the tab actually connected from, which `isOriginAllowed` already vetted at CONNECT.
 * An opaque origin (`about:blank`) or a privileged scheme simply fails that
 * comparison, so a second, weaker copy of the allow-list rule would add nothing.
 */
export function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
