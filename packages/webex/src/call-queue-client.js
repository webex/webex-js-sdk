import * as WebexCalling from '@webex/calling';

/**
 * Initialize the optional queue client and clean up the previous one.
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
    if (previousClient) {
      previousClient.dispose();
    }

    return enabled ? WebexCalling.createCallQueueClient(webex, logger, options) : undefined;
  } catch (error) {
    log.warn(`Error occurred while initializing callQueue client ${error}`, logContext);

    return undefined;
  }
}
