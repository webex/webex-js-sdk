import {zip} from 'lodash';
import HashTree, {LeafDataItem} from './hashTree';
import LoggerProxy from '../common/logs/logger-proxy';
import {Enum, HTTP_VERBS} from '../constants';
import {DataSetNames, EMPTY_HASH} from './constants';

export interface DataSet {
  url: string;
  root: string;
  version: number;
  leafCount: number;
  name: string;
  idleMs: number;
  backoff: {
    maxMs: number;
    exponent: number;
  };
}

export const ObjectType = {
  participant: 'PARTICIPANT',
  self: 'SELF',
  locus: 'LOCUS',
} as const;

export type ObjectType = Enum<typeof ObjectType>;

export interface HashTreeObject {
  meta: {
    type: ObjectType;
    id: number;
    version: number;
  };
  data: any; // todo: can we have a better type here?
}

export interface RootHashMessage {
  dataSets: Array<DataSet>;
}
export interface HashTreeMessage {
  dataSets: Array<DataSet>;
  objects?: Array<HashTreeObject>;
}

interface InternalDataSet extends DataSet {
  hashTree: HashTree;
  timer?: ReturnType<typeof setTimeout>;
}

type WebexRequestMethod = (options: Record<string, any>) => Promise<any>;

export const LocusInfoUpdateType = {
  OBJECTS_UPDATED: 'OBJECTS_UPDATED',
  MEETING_ENDED: 'MEETING_ENDED',
} as const;

export type LocusInfoUpdateType = Enum<typeof LocusInfoUpdateType>;
export type LocusInfoUpdateCallback = (
  updateType: LocusInfoUpdateType,
  data?: {updatedObjects: HashTreeObject[]}
) => void;
/**
 * Parses hash tree eventing locus data
 */
class HashTreeParser {
  dataSets: Record<string, InternalDataSet> = {};
  webexRequest: WebexRequestMethod;
  locusInfoUpdateCallback: LocusInfoUpdateCallback;
  /**
   * Constructor for HashTreeParser
   * @param {Object} options
   * @param {Object} options.initialLocus The initial locus data containing the hash tree information
   */
  constructor(options: {
    initialLocus: {
      dataSets: Array<DataSet>;
      locus: any;
    };
    webexRequest: WebexRequestMethod;
    locusInfoUpdateCallback: LocusInfoUpdateCallback;
  }) {
    const {dataSets, locus} = options.initialLocus; // extract dataSets from initialLocus

    this.webexRequest = options.webexRequest;
    this.locusInfoUpdateCallback = options.locusInfoUpdateCallback;

    // object mapping dataset names to arrays of leaf data
    const leafData: Record<string, Array<{type: string; id: number; version: number}>> = {};

    // each dataset exists at a different place in the dto
    // iterate recursively over the locus and if it has a meta key,
    // create an object with the type, id and version and add it to the appropriate leafData array

    const findAndStoreMetaData = (currentLocusPart: any) => {
      if (typeof currentLocusPart !== 'object' || currentLocusPart === null) {
        return;
      }

      if (currentLocusPart.meta && currentLocusPart.meta.dataSets) {
        const {type, id, version, dataSets: metaDataSets} = currentLocusPart.meta;
        const leafInfo = {type, id, version};

        for (const dataSetName of metaDataSets) {
          if (!leafData[dataSetName]) {
            leafData[dataSetName] = [];
          }
          leafData[dataSetName].push(leafInfo);
        }
      }

      if (Array.isArray(currentLocusPart)) {
        for (const item of currentLocusPart) {
          findAndStoreMetaData(item);
        }
      } else {
        for (const key of Object.keys(currentLocusPart)) {
          if (Object.prototype.hasOwnProperty.call(currentLocusPart, key)) {
            findAndStoreMetaData(currentLocusPart[key]);
          }
        }
      }
    };

    findAndStoreMetaData(locus);

    for (const dataSet of dataSets) {
      const {name, leafCount} = dataSet;

      const hashTree = new HashTree(leafData[name] || [], leafCount);

      this.dataSets[name] = {
        ...dataSet,
        hashTree,
      };
    }
  }

  /**
   * Checks if the provided hash tree message indicates the end of the meeting and that there won't be any more updates.
   *
   * @param {HashTreeMessage} message - The hash tree message to check
   * @returns {boolean} - Returns true if the message indicates the end of the meeting, false otherwise
   */
  private isEndMessage(message: HashTreeMessage) {
    const mainDataSet = message.dataSets.find((dataSet) => dataSet.name === DataSetNames.MAIN);

    if (
      mainDataSet &&
      mainDataSet.leafCount === 1 &&
      mainDataSet.root === EMPTY_HASH &&
      this.dataSets[DataSetNames.MAIN].version < mainDataSet.version
    ) {
      // this is a special way for Locus to indicate that this meeting has ended
      return true;
    }

    return false;
  }

  /**
   * Handles the root hash heartbeat message
   *
   * @param {RootHashMessage} message - The root hash heartbeat message
   * @returns {void}
   */
  handleRootHashHeartBeatMessage(message: RootHashMessage): void {
    const {dataSets} = message;

    LoggerProxy.logger.info(
      `HashTreeParser#handleRootHashMessage --> Received root hash message with data sets: ${JSON.stringify(
        dataSets.map(({name, root, leafCount, version}) => ({
          name,
          root,
          leafCount,
          version,
        }))
      )}`
    );
    dataSets.forEach((dataSet) => {
      this.runSyncAlgorithm(dataSet);
    });
  }

  /**
   * Handles incoming hash tree messages, updates the hash trees and calls locusInfoUpdateCallback
   *
   * @param {HashTreeMessage} message - The hash tree message containing data sets and objects to be processed
   * @returns {void}
   */
  handleMessage(message: HashTreeMessage): void {
    const {dataSets} = message;

    if (this.isEndMessage(message)) {
      this.stopAllTimers();
      this.locusInfoUpdateCallback(LocusInfoUpdateType.MEETING_ENDED);
    } else {
      const updatedObjects: HashTreeObject[] = [];

      dataSets.forEach((dataSet) => {
        if (this.dataSets[dataSet.name]) {
          const {hashTree} = this.dataSets[dataSet.name];

          if (hashTree) {
            const appliedChangesList = hashTree.updateItems(
              message.objects.map((object) =>
                object.data
                  ? {operation: 'update', item: object.meta}
                  : {operation: 'remove', item: object.meta}
              )
            );

            zip(appliedChangesList, message.objects).forEach(([changeApplied, object]) => {
              if (changeApplied) {
                // update the locus with the new object
                updatedObjects.push(object);
              }
            });
          } else {
            LoggerProxy.logger.warn(
              `Locus-info:index#handleHashTreeMessage --> unsupported dataSet ${dataSet.name} received in hash tree message`
            );
          }

          // update our version of the dataSet
          if (this.dataSets[dataSet.name].version < dataSet.version) {
            this.dataSets[dataSet.name].version = dataSet.version;
            this.dataSets[dataSet.name].root = dataSet.root;
            this.dataSets[dataSet.name].idleMs = dataSet.idleMs;
            this.dataSets[dataSet.name].backoff = {
              maxMs: dataSet.backoff.maxMs,
              exponent: dataSet.backoff.exponent,
            };
          }

          this.runSyncAlgorithm(dataSet);
        }
      });

      this.locusInfoUpdateCallback(LocusInfoUpdateType.OBJECTS_UPDATED, {updatedObjects});
    }
  }

  /**
   * Calculates a weighted backoff time that should be used for syncs
   *
   * @param {Object} backoff - The backoff configuration containing maxMs and exponent
   * @returns {number} - A weighted backoff time based on the provided configuration, using algorithm supplied by Locus team
   */
  private getWeightedBackoffTime(backoff: {maxMs: number; exponent: number}): number {
    const {maxMs, exponent} = backoff;

    const randomValue = Math.random();

    return Math.round(randomValue ** exponent * maxMs);
  }

  /**
   * Runs the sync algorithm for the given data set.
   *
   * @param {DataSet} receivedDataSet - The data set to run the sync algorithm for.
   * @returns {void}
   */
  private runSyncAlgorithm(receivedDataSet: DataSet) {
    const dataSet = this.dataSets[receivedDataSet.name];

    if (!dataSet) {
      LoggerProxy.logger.warn(
        `HashTreeParser#runSyncAlgorithm --> No data set found for ${receivedDataSet.name}, skipping sync algorithm`
      );

      return;
    }

    dataSet.hashTree.resize(receivedDataSet.leafCount);

    const delay = dataSet.idleMs + this.getWeightedBackoffTime(dataSet.backoff);

    if (dataSet.timer) {
      clearTimeout(dataSet.timer);
    }

    dataSet.timer = setTimeout(async () => {
      LoggerProxy.logger.info(
        `HashTreeParser#runSyncAlgorithm --> Sync timer fired for "${dataSet.name}" data set`
      );

      dataSet.timer = undefined;

      const rootHash = dataSet.hashTree.getRootHash();

      if (dataSet.root !== rootHash) {
        LoggerProxy.logger.info(
          `HashTreeParser#runSyncAlgorithm --> Root hash mismatch: received=${dataSet.root}, ours=${rootHash}, syncing data set "${dataSet.name}"`
        );

        const mismatchedLeavesData: Record<number, LeafDataItem[]> = {};

        if (dataSet.leafCount !== 1) {
          let receivedHashes;

          try {
            // request hashes from sender
            receivedHashes = await this.getHashesFromLocus(dataSet.name);
          } catch (error) {
            if (error.statusCode === 409) {
              // this is a leaf count mismatch, we should do nothing, just wait for another heartbeat message from Locus
              LoggerProxy.logger.info(
                `HashTreeParser#getHashesFromLocus --> Got 409 when fetching hashes for data set "${dataSet.name}": ${error.message}`
              );

              return;
            }
            throw error;
          }

          // identify mismatched leaves
          const mismatchedLeaveIndexes = dataSet.hashTree.diffHashes(receivedHashes);

          mismatchedLeaveIndexes.forEach((index) => {
            mismatchedLeavesData[index] = dataSet.hashTree.getLeafData(index);
          });
        } else {
          mismatchedLeavesData[0] = dataSet.hashTree.getLeafData(0);
        }

        // request sync for mismatched leaves
        if (Object.keys(mismatchedLeavesData).length > 0) {
          const updatedObjects = await this.sendSyncRequestToLocus(dataSet, mismatchedLeavesData);

          if (updatedObjects.length > 0) {
            this.locusInfoUpdateCallback(LocusInfoUpdateType.OBJECTS_UPDATED, {updatedObjects});
          }
        }
      }
    }, delay);
  }

  /**
   * Stops all timers for the data sets to prevent any further sync attempts.
   * @returns {void}
   */
  stopAllTimers() {
    Object.values(this.dataSets).forEach((dataSet) => {
      if (dataSet.timer) {
        clearTimeout(dataSet.timer);
        dataSet.timer = undefined;
      }
    });
  }

  /**
   * Gets the current hashes from the locus for a specific data set.
   * @param {string} dataSetName
   * @returns {string[]}
   */
  private getHashesFromLocus(dataSetName: string) {
    LoggerProxy.logger.info(
      `HashTreeParser#getHashesFromLocus --> Requesting hashes for data set "${dataSetName}"`
    );

    const dataSet = this.dataSets[dataSetName];

    const url = `${dataSet.url}/hashtree`;

    // todo: docs have some request body.... need to confirm this
    return this.webexRequest({
      method: HTTP_VERBS.GET,
      uri: url,
    })
      .then((response) => {
        const hashes = response.body?.hashTree?.values;

        if (!hashes || !Array.isArray(hashes)) {
          throw new Error('Locus returned invalid hashes', response.body);
        }

        LoggerProxy.logger.info(
          `HashTreeParser#getHashesFromLocus --> Received hashes for data set "${dataSetName}": ${JSON.stringify(
            hashes
          )}`
        );

        return hashes;
      })
      .catch((error) => {
        LoggerProxy.logger.error(
          `HashTreeParser#getHashesFromLocus --> Error ${error.statusCode} fetching hashes for data set "${dataSetName}":`,
          error
        );
        throw error;
      });
  }

  /**
   * Sends a sync request to Locus for the specified data set.
   *
   * @param {InternalDataSet} dataSet The data set to sync.
   * @param {Record<number, LeafDataItem[]>} mismatchedLeavesData The mismatched leaves data to include in the sync request.
   * @returns {Promise<HashTreeObject[]>}
   */
  private sendSyncRequestToLocus(
    dataSet: InternalDataSet,
    mismatchedLeavesData: Record<number, LeafDataItem[]>
  ): Promise<HashTreeObject[]> {
    LoggerProxy.logger.info(
      `HashTreeParser#sendSyncRequestToLocus --> Sending sync request for data set "${dataSet.name}"`
    );

    const url = `${dataSet.url}/sync`;
    const body = {
      meta: {
        leafCount: dataSet.leafCount,
        rootHash: dataSet.hashTree.getRootHash(), // todo: avoid recalculation
      },
      leafData: [],
    };

    Object.keys(mismatchedLeavesData).forEach((index) => {
      body.leafData.push({
        leafIndex: parseInt(index, 10),
        objectIds: mismatchedLeavesData[index],
      });
    });

    return this.webexRequest({
      method: HTTP_VERBS.POST,
      uri: url,
      body,
    })
      .then((resp) => {
        LoggerProxy.logger.info(
          `HashTreeParser#sendSyncRequestToLocus --> Sync request sent successfully for data set "${dataSet.name}"`
        );
        // todo: handle response body (it may be there or not)
        if (resp.body === 202) {
          LoggerProxy.logger.info(
            `HashTreeParser#sendSyncRequestToLocus --> Got 202 for sync request for data set "${dataSet.name}", data should arrive via messages`
          );
        }
        const updatedObjects = resp.body?.objects || [];

        return updatedObjects;
      })
      .catch((error) => {
        LoggerProxy.logger.error(
          `HashTreeParser#sendSyncRequestToLocus --> Error ${error.statusCode} sending sync request for data set "${dataSet.name}":`,
          error
        );
        throw error;
      });
  }
}

export default HashTreeParser;
