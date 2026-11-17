import * as WebexCalling from '@webex/calling';

// Keep wrapper-owned clients reusable without retaining their Webex instances.
const configurations = new WeakMap();

/**
 * Initialize or reuse the optional queue client and clean up an incompatible one.
 *
 * @param {object} config - Queue client and initialization context.
 * @returns {object|undefined} The new queue client, if created.
 */
export default function initializeCallQueueClient({
  enabled,
  previousClient,
  webex,
  logger,
  options,
  log,
  logContext,
}) {
  try {
    const previousConfig = previousClient && configurations.get(previousClient);
    const userId = webex.internal.device?.userId;
    const orgId = webex.internal.device?.orgId;
    const compatible =
      enabled &&
      previousConfig &&
      previousConfig.webex === webex &&
      previousConfig.apiBaseUrl === options?.webexApiBaseUrl &&
      previousConfig.loggerLevel === logger?.level &&
      previousConfig.userId === userId &&
      previousConfig.orgId === orgId;

    if (compatible && typeof previousClient.prepareForReuse === 'function') {
      let ready;
      try {
        ready = previousClient.prepareForReuse();
      } catch (error) {
        try {
          previousClient.dispose();
        } catch (cleanupError) {
          log.warn(`Error occurred while disposing callQueue client ${cleanupError}`, logContext);
        }
        throw error;
      }
      if (ready) return previousClient;
    }

    if (previousClient) {
      previousClient.dispose();
    }

    if (!enabled) return undefined;

    const client = WebexCalling.createCallQueueClient(webex, logger, options);
    if (client && (typeof client === 'object' || typeof client === 'function')) {
      configurations.set(client, {
        webex,
        apiBaseUrl: options?.webexApiBaseUrl,
        loggerLevel: logger?.level,
        userId,
        orgId,
      });
    }

    return client;
  } catch (error) {
    log.warn(`Error occurred while initializing callQueue client ${error}`, logContext);

    return undefined;
  }
}
