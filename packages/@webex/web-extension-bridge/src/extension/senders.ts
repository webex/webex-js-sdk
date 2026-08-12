import type {ChromeLike, ChromeSender} from './platform';

/**
 * Runtime sender checks.
 *
 * A manifest's `matches` list is a deployment control, not a runtime one: it says
 * where the content script is injected, not who sent the message currently being
 * handled. Every privileged hop therefore re-checks the sender here.
 */

/**
 * @param chromeApi - Platform object.
 * @param sender - Reported sender.
 * @returns Whether the message came from this extension at all.
 */
export function isOwnExtension(chromeApi: ChromeLike, sender: ChromeSender | undefined): boolean {
  return typeof sender?.id === 'string' && sender.id === chromeApi.runtime.id;
}

/**
 * @param chromeApi - Platform object.
 * @param sender - Reported sender.
 * @returns Whether the message came from an extension page (popup, options, side
 *   panel). Such messages have no `tab`, which is what distinguishes them from a
 *   content script that may be running in a hostile page.
 */
export function isFromExtensionPage(
  chromeApi: ChromeLike,
  sender: ChromeSender | undefined
): boolean {
  return isOwnExtension(chromeApi, sender) && sender?.tab === undefined;
}

/**
 * @param chromeApi - Platform object.
 * @param sender - Reported sender.
 * @returns Whether the message came from one of our content scripts, narrowing the
 *   sender so `tab.id` is known to be present.
 */
export function isFromContentScript(
  chromeApi: ChromeLike,
  sender: ChromeSender | undefined
): sender is ChromeSender & {tab: {id: number; url?: string}} {
  return isOwnExtension(chromeApi, sender) && typeof sender?.tab?.id === 'number';
}

/**
 * @param allowed - Configured runtime allow-list, or `undefined` to defer to the
 *   manifest.
 * @param origin - Reported sender origin.
 * @returns Whether the origin is acceptable.
 */
export function isOriginAllowed(
  allowed: Set<string> | undefined,
  origin: string | undefined
): boolean {
  if (!allowed) {
    return true;
  }

  return typeof origin === 'string' && allowed.has(origin);
}
