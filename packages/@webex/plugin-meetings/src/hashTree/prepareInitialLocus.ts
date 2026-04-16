/* eslint-disable import/prefer-default-export */
import LoggerProxy from '../common/logs/logger-proxy';
import {createLocusFromHashTreeMessage} from '../locus-info';
import HashTreeParser, {HashTreeMessage, LocusInfoUpdateType} from './hashTreeParser';
import {HashTreeObject} from './types';
import {isMetadata} from './utils';

type WebexRequestMethod = (options: Record<string, any>) => Promise<any>;
type LocusReadyCallback = (locus: any) => void;

// Track in-flight hydration per locus URL to avoid duplicate meeting creation races.
const inProgressLocusHydration = new Set<string>();

type PrepareInitialLocusOptions = {
  message?: HashTreeMessage;
  webexRequest: WebexRequestMethod;
  excludedDataSets?: string[];
  onLocusReady: LocusReadyCallback;
};

/**
 * Best-effort hydration for hash-tree locus before creating a Meeting.
 * It reuses a temporary HashTreeParser to fetch visible datasets and sync missing objects.
 *
 * @param {PrepareInitialLocusOptions} options hydration options
 * @returns {void}
 */
export function prepareInitialLocus({
  message,
  webexRequest,
  excludedDataSets,
  onLocusReady,
}: PrepareInitialLocusOptions): void {
  if (!message) {
    return;
  }

  const {locusUrl} = message;

  const {locus} = createLocusFromHashTreeMessage(message);

  // No need to perform extra network calls when minimum fields already exist.
  if (locus?.self && locus?.info) {
    onLocusReady(locus);

    return;
  }

  if (!message.visibleDataSetsUrl) {
    onLocusReady(locus);

    return;
  }

  const metadataObject = message.locusStateElements?.find((el) => isMetadata(el));

  if (!metadataObject?.data?.visibleDataSets?.length) {
    onLocusReady(locus);

    return;
  }

  if (locusUrl && inProgressLocusHydration.has(locusUrl)) {
    LoggerProxy.logger.log(
      `prepareInitialLocus --> skip duplicate hydration request for locusUrl: ${locusUrl}`
    );

    return;
  }

  if (locusUrl) {
    inProgressLocusHydration.add(locusUrl);
  }

  const collectedUpdates: HashTreeObject[] = [];
  const tempHashTreeParser = new HashTreeParser({
    initialLocus: {
      locus: null,
      dataSets: message.dataSets,
    },
    metadata: {
      htMeta: metadataObject.htMeta,
      visibleDataSets: metadataObject.data.visibleDataSets,
    },
    webexRequest,
    locusInfoUpdateCallback: (update) => {
      if (
        update.updateType === LocusInfoUpdateType.OBJECTS_UPDATED &&
        update.updatedObjects?.length
      ) {
        collectedUpdates.push(...update.updatedObjects);
      }
    },
    debugId: `HT-PreCreate-${message.locusUrl.split('/')?.pop()?.substring(0, 4)}`,
    excludedDataSets,
  });

  tempHashTreeParser
    .initializeFromMessage(message)
    .then(() => {
      const {locus: hydratedLocus} = createLocusFromHashTreeMessage({
        ...message,
        locusStateElements: [...(message.locusStateElements || []), ...collectedUpdates],
      });

      onLocusReady(hydratedLocus);
    })
    .catch((error) => {
      LoggerProxy.logger.warn(
        `prepareInitialLocus --> failed to hydrate locus before create: ${error}`
      );
      onLocusReady(locus);
    })
    .finally(() => {
      if (locusUrl) {
        inProgressLocusHydration.delete(locusUrl);
      }
      tempHashTreeParser.cleanUp();
    });
}
