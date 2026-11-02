import {MAX_STORED_URL_LENGTH} from '../core/constants';
import type {ChromeTabChangeInfo} from './platform';

/** A {@link ChromeTabChangeInfo} known to carry a new url. */
export type UrlChange = ChromeTabChangeInfo & {url: string};

/**
 * @param changeInfo - What Chrome reported changed about a tab.
 * @returns Whether the update carries a new url to interpret.
 *
 * There is deliberately no companion guard for "this navigation replaced the
 * document". `changeInfo` cannot express it. Measured against Chrome, the shapes are:
 *
 * | Navigation                                     | What Chrome reports                                |
 * | ---------------------------------------------- | -------------------------------------------------- |
 * | `pushState` / `replaceState` / fragment / back | `{status: 'loading', url}`, `{status: 'complete'}` |
 * | Reload                                         | `{status: 'loading'}`, `{status: 'complete'}`      |
 * | Followed link to another document              | `{status: 'loading', url}`, `{status: 'complete'}` |
 *
 * A single-page app's route change and a followed link are byte-identical, so
 * `status === 'loading'` says only that the tab is busy — never that the document a
 * connection was established in has gone. Teardown is therefore keyed on the one thing
 * these updates do report reliably, the origin, and the loss of a document is learned
 * from the document itself: a replacement relay's `CONNECT`, or a send that fails
 * because nothing is listening.
 */
export function hasUrlChange(changeInfo: ChromeTabChangeInfo): changeInfo is UrlChange {
  return typeof changeInfo.url === 'string';
}

/**
 * @param url - Url the tab reported navigating to.
 * @returns Whether it is small enough to keep in the connection record.
 *
 * Separate from {@link hasUrlChange} on purpose: the origin comparison that decides
 * whether to tear a connection down must run on *every* url Chrome reports, so an
 * over-long one cannot be used to skip it. The bound applies only to what reaches
 * `chrome.storage.session`, where an unbounded string from the page's address bar
 * would otherwise be the one persisted value with no ceiling.
 */
export function isStorableUrl(url: string): boolean {
  return url.length <= MAX_STORED_URL_LENGTH;
}

/**
 * @param url - Url Chrome reported for a tab.
 * @returns The url's origin, or `undefined` when it cannot be parsed.
 *
 * Deliberately not allow-list checked: callers compare the result against the origin
 * the tab actually connected from, which `isOriginAllowed` already vetted at CONNECT.
 * An opaque origin (`about:blank`) or a privileged scheme simply fails that
 * comparison, so a second, weaker copy of the allow-list rule would add nothing.
 *
 * Note that the comparison can only run where Chrome discloses the url at all. A tab
 * update omits `url` entirely for a destination the extension holds no host permission
 * for, which is why a tab leaving the connected origin is not always observable here.
 * That split is benign, and it is the reason this check is worth keeping:
 *
 * - Host permission covers the destination: the url is disclosed and this comparison
 *   ends the connection. That is the case that matters, because it is where the
 *   extension could still reach the page — a `matches` pattern broadened past
 *   `allowedOrigins` being the way it arises.
 * - It does not: the url is withheld, so nothing here fires, but the extension has no
 *   access to that document either. The record is merely stale until the first send to
 *   it fails and removes it.
 */
export function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
