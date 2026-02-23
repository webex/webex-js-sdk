import {cloneDeep, isEmpty, zip} from 'lodash';
import HashTree, {LeafDataItem} from './hashTree';
import LoggerProxy from '../common/logs/logger-proxy';
import {Enum, HTTP_VERBS} from '../constants';
import {DataSetNames, EMPTY_HASH} from './constants';
import {ObjectType, HtMeta, HashTreeObject} from './types';
import {LocusDTO} from '../locus-info/types';
import {deleteNestedObjectsWithHtMeta, isMetadata, isSelf} from './utils';

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

export interface RootHashMessage {
  dataSets: Array<DataSet>;
}
export interface HashTreeMessage {
  dataSets: Array<DataSet>;
  visibleDataSetsUrl: string; // url from which we can get more info about all data sets - now it seems to be visibleDataSetsUrl
  locusStateElements?: Array<HashTreeObject>;
  locusSessionId?: string;
  locusUrl: string;
}

export interface VisibleDataSetInfo {
  name: string;
  url: string;
  dataChannelUrl?: string;
}

export interface Metadata {
  htMeta: HtMeta;
  visibleDataSets: VisibleDataSetInfo[];
}

interface InternalDataSet extends DataSet {
  hashTree?: HashTree; // set only for visible data sets
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

interface LeafInfo {
  type: ObjectType;
  id: number;
  version: number;
  data?: any;
}

/**
 * This error is thrown if we receive information that the meeting has ended while we're processing some hash messages.
 * It's handled internally by HashTreeParser and results in MEETING_ENDED being sent up.
 */
class MeetingEndedError extends Error {}

/* Currently Locus always sends Metadata objects only in the "self" dataset.
 * If this ever changes, update all the code that relies on this constant.
 */
const MetadataDataSetName = DataSetNames.SELF;

/**
 * Parses hash tree eventing locus data
 */
class HashTreeParser {
  dataSets: Record<string, InternalDataSet> = {};
  visibleDataSetsUrl: string; // url from which we can get info about all data sets
  webexRequest: WebexRequestMethod;
  locusInfoUpdateCallback: LocusInfoUpdateCallback;
  visibleDataSets: VisibleDataSetInfo[];
  debugId: string;

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
    metadata: Metadata | null;
    webexRequest: WebexRequestMethod;
    locusInfoUpdateCallback: LocusInfoUpdateCallback;
    debugId: string;
  }) {
    const {dataSets, locus} = options.initialLocus; // extract dataSets from initialLocus

    this.debugId = options.debugId;
    this.webexRequest = options.webexRequest;
    this.locusInfoUpdateCallback = options.locusInfoUpdateCallback;
    this.visibleDataSetsUrl = locus?.links?.resources?.visibleDataSets?.url;
    this.visibleDataSets = cloneDeep(options.metadata?.visibleDataSets || []);

    if (options.metadata?.visibleDataSets?.length === 0) {
      LoggerProxy.logger.warn(
        `HashTreeParser#constructor --> ${this.debugId} No visibleDataSets found in Metadata`
      );
    }
    // object mapping dataset names to arrays of leaf data
    const leafData = this.analyzeLocusHtMeta(locus);

    if (options.metadata) {
      // add also the metadata that's outside of locus object itself
      this.analyzeMetadata(leafData, options.metadata);
    }

    LoggerProxy.logger.info(
      `HashTreeParser#constructor --> creating HashTreeParser for datasets: ${JSON.stringify(
        dataSets.map((ds) => ds.name)
      )}`
    );

    for (const dataSet of dataSets) {
      const {name, leafCount} = dataSet;

      this.dataSets[name] = {
        ...dataSet,
        hashTree: this.isVisibleDataSet(name)
          ? new HashTree(leafData[name] || [], leafCount)
          : undefined,
      };
    }
  }

  /**
   * Checks if the given data set name is in the list of visible data sets
   * @param {string} dataSetName data set name to check
   * @returns {Boolean} True if the data set is visible, false otherwise
   */
  private isVisibleDataSet(dataSetName: string): boolean {
    return this.visibleDataSets.some((vds) => vds.name === dataSetName);
  }

  /**
   * Initializes a new visible data set by creating a hash tree for it, adding it to all the internal structures,
   * and sending an initial sync request to Locus with empty leaf data - that will trigger Locus to gives us all the data
   * from that dataset (in the response or via messages).
   *
   * @param {VisibleDataSetInfo} visibleDataSetInfo Information about the new visible data set
   * @param {DataSet} dataSetInfo The new data set to be added
   * @returns {Promise}
   */
  private initializeNewVisibleDataSet(
    visibleDataSetInfo: VisibleDataSetInfo,
    dataSetInfo: DataSet
  ): Promise<{updateType: LocusInfoUpdateType; updatedObjects?: HashTreeObject[]}> {
    if (this.isVisibleDataSet(dataSetInfo.name)) {
      LoggerProxy.logger.info(
        `HashTreeParser#initializeNewVisibleDataSet --> ${this.debugId} Data set "${dataSetInfo.name}" already exists, skipping init`
      );

      return Promise.resolve({updateType: LocusInfoUpdateType.OBJECTS_UPDATED, updatedObjects: []});
    }

    LoggerProxy.logger.info(
      `HashTreeParser#initializeNewVisibleDataSet --> ${this.debugId} Adding visible data set "${dataSetInfo.name}"`
    );

    this.visibleDataSets.push(visibleDataSetInfo);

    const hashTree = new HashTree([], dataSetInfo.leafCount);

    this.dataSets[dataSetInfo.name] = {
      ...dataSetInfo,
      hashTree,
    };

    return this.sendInitializationSyncRequestToLocus(dataSetInfo.name, 'new visible data set');
  }

  /**
   * Sends a special sync request to Locus with all leaves empty - this is a way to get all the data for a given dataset.
   *
   * @param {string} datasetName - name of the dataset for which to send the request
   * @param {string} debugText - text to include in logs
   * @returns {Promise}
   */
  private sendInitializationSyncRequestToLocus(
    datasetName: string,
    debugText: string
  ): Promise<{updateType: LocusInfoUpdateType; updatedObjects?: HashTreeObject[]}> {
    const dataset = this.dataSets[datasetName];

    if (!dataset) {
      LoggerProxy.logger.warn(
        `HashTreeParser#sendInitializationSyncRequestToLocus --> ${this.debugId} No data set found for ${datasetName}, cannot send the request for leaf data`
      );

      return Promise.resolve(null);
    }

    const emptyLeavesData = new Array(dataset.leafCount).fill([]);

    LoggerProxy.logger.info(
      `HashTreeParser#sendInitializationSyncRequestToLocus --> ${this.debugId} Sending initial sync request to Locus for data set "${datasetName}" with empty leaf data`
    );

    return this.sendSyncRequestToLocus(this.dataSets[datasetName], emptyLeavesData).then(
      (syncResponse) => {
        if (syncResponse) {
          return this.parseMessage(
            syncResponse,
            `via empty leaves /sync API call for ${debugText}`
          );
        }

        return {updateType: LocusInfoUpdateType.OBJECTS_UPDATED, updatedObjects: []};
      }
    );
  }

  /**
   * Queries Locus for all up-to-date information about all visible data sets
   *
   * @returns {Promise}
   */
  private getAllVisibleDataSetsFromLocus() {
    if (!this.visibleDataSetsUrl) {
      LoggerProxy.logger.warn(
        `HashTreeParser#getAllVisibleDataSetsFromLocus --> ${this.debugId} No visibleDataSetsUrl, cannot get data sets information`
      );

      return Promise.resolve([]);
    }

    return this.webexRequest({
      method: HTTP_VERBS.GET,
      uri: this.visibleDataSetsUrl,
    }).then((response) => {
      return response.body.dataSets as Array<DataSet>;
    });
  }

  /**
   * Initializes the hash tree parser from a message received from Locus.
   *
   * @param {HashTreeMessage} message - initial hash tree message received from Locus
   * @returns {Promise}
   */
  async initializeFromMessage(message: HashTreeMessage) {
    this.visibleDataSetsUrl = message.visibleDataSetsUrl;

    LoggerProxy.logger.info(
      `HashTreeParser#initializeFromMessage --> ${this.debugId} visibleDataSetsUrl=${this.visibleDataSetsUrl}`
    );
    const visibleDataSets = await this.getAllVisibleDataSetsFromLocus();

    await this.initializeDataSets(visibleDataSets, 'initialization from message');
  }

  /**
   * Initializes the hash tree parser from GET /loci API response by fetching all data sets metadata
   * first and then doing an initialization sync on each data set
   *
   * This function requires that this.visibleDataSets have been already populated correctly by the constructor.
   *
   * @param {LocusDTO} locus - locus object received from GET /loci
   * @returns {Promise}
   */
  async initializeFromGetLociResponse(locus: LocusDTO) {
    if (!locus?.links?.resources?.visibleDataSets?.url) {
      LoggerProxy.logger.warn(
        `HashTreeParser#initializeFromGetLociResponse --> ${this.debugId} missing visibleDataSets url in GET Loci response, cannot initialize hash trees`
      );

      return;
    }
    this.visibleDataSetsUrl = locus.links.resources.visibleDataSets.url;

    LoggerProxy.logger.info(
      `HashTreeParser#initializeFromGetLociResponse --> ${this.debugId} visibleDataSets url: ${this.visibleDataSetsUrl}`
    );

    const visibleDataSets = await this.getAllVisibleDataSetsFromLocus();

    await this.initializeDataSets(visibleDataSets, 'initialization from GET /loci response');
  }

  /**
   * Initializes data sets by doing an initialization sync on each visible data set that doesn't have a hash tree yet.
   *
   * @param {DataSet[]} visibleDataSets Array of visible DataSet objects to initialize
   * @param {string} debugText Text to include in logs for debugging purposes
   * @returns {Promise}
   */
  private async initializeDataSets(visibleDataSets: Array<DataSet>, debugText: string) {
    const updatedObjects: HashTreeObject[] = [];

    for (const dataSet of visibleDataSets) {
      const {name, leafCount, url} = dataSet;

      if (!this.dataSets[name]) {
        LoggerProxy.logger.info(
          `HashTreeParser#initializeDataSets --> ${this.debugId} initializing dataset "${name}" (${debugText})`
        );

        this.dataSets[name] = {
          ...dataSet,
        };
      } else {
        LoggerProxy.logger.info(
          `HashTreeParser#initializeDataSets --> ${this.debugId} dataset "${name}" already exists (${debugText})`
        );
      }

      if (!this.isVisibleDataSet(name)) {
        this.visibleDataSets.push({
          name,
          url,
        });
      }

      if (!this.dataSets[name].hashTree) {
        LoggerProxy.logger.info(
          `HashTreeParser#initializeDataSets --> ${this.debugId} creating hash tree for visible dataset "${name}" (${debugText})`
        );
        this.dataSets[name].hashTree = new HashTree([], leafCount);

        // eslint-disable-next-line no-await-in-loop
        const data = await this.sendInitializationSyncRequestToLocus(name, debugText);

        if (data.updateType === LocusInfoUpdateType.MEETING_ENDED) {
          LoggerProxy.logger.warn(
            `HashTreeParser#initializeDataSets --> ${this.debugId} meeting ended while initializing new visible data set "${name}"`
          );

          // throw an error, it will be caught higher up and the meeting will be destroyed
          throw new MeetingEndedError();
        }

        if (data.updateType === LocusInfoUpdateType.OBJECTS_UPDATED) {
          updatedObjects.push(...(data.updatedObjects || []));
        }
      }
    }

    this.callLocusInfoUpdateCallback({
      updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
      updatedObjects,
    });
  }

  /**
   * Each dataset exists at a different place in the dto
   * iterate recursively over the locus and if it has a htMeta key,
   * create an object with the type, id and version and add it to the appropriate leafData array
   *
   * @param {any} locus - The current part of the locus being processed
   * @param {Object} [options]
   * @param {boolean} [options.copyData=false] - Whether to copy the data for each leaf into returned result
   * @returns {any} - An object mapping dataset names to arrays of leaf data
   */
  private analyzeLocusHtMeta(locus: any, options?: {copyData?: boolean}) {
    const {copyData = false} = options || {};
    // object mapping dataset names to arrays of leaf data
    const leafInfo: Record<string, Array<LeafInfo>> = {};

    const findAndStoreMetaData = (currentLocusPart: any) => {
      if (typeof currentLocusPart !== 'object' || currentLocusPart === null) {
        return;
      }

      if (currentLocusPart.htMeta && currentLocusPart.htMeta.dataSetNames) {
        const {type, id, version} = currentLocusPart.htMeta.elementId;
        const {dataSetNames} = currentLocusPart.htMeta;
        const newLeafInfo: LeafInfo = {
          type,
          id,
          version,
        };

        if (copyData) {
          newLeafInfo.data = cloneDeep(currentLocusPart);

          // remove any nested other objects that have their own htMeta
          deleteNestedObjectsWithHtMeta(newLeafInfo.data);
        }

        for (const dataSetName of dataSetNames) {
          if (!leafInfo[dataSetName]) {
            leafInfo[dataSetName] = [];
          }
          leafInfo[dataSetName].push(newLeafInfo);
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

    return leafInfo;
  }

  /**
   * Analyzes the Metadata object that is sent outside of Locus object, and appends its data to passed in leafInfo
   * structure.
   *
   * @param {Record<string, LeafInfo[]>} leafInfo the structure to which the Metadata info will be appended
   * @param {Metadata} metadata Metadata object
   * @returns {void}
   */
  private analyzeMetadata(leafInfo: Record<string, LeafInfo[]>, metadata: Metadata) {
    const {htMeta} = metadata;

    if (
      htMeta?.dataSetNames?.length === 1 &&
      htMeta.dataSetNames[0].toLowerCase() === MetadataDataSetName
    ) {
      const {type, id, version} = metadata.htMeta.elementId;

      const dataSetName = htMeta.dataSetNames[0];

      if (!leafInfo[dataSetName]) {
        leafInfo[dataSetName] = [];
      }

      leafInfo[dataSetName].push({
        type,
        id,
        version,
      });
    } else {
      throw new Error(
        `${this.debugId} Metadata htMeta has unexpected dataSetNames: ${
          htMeta && htMeta.dataSetNames.join(',')
        }`
      );
    }
  }

  /**
   * Checks if the provided hash tree message indicates the end of the meeting and that there won't be any more updates.
   *
   * @param {HashTreeMessage} message - The hash tree message to check
   * @returns {boolean} - Returns true if the message indicates the end of the meeting, false otherwise
   */
  private isEndMessage(message: HashTreeMessage) {
    const mainDataSet = message.dataSets.find(
      (dataSet) => dataSet.name.toLowerCase() === DataSetNames.MAIN
    );

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
  private handleRootHashHeartBeatMessage(message: RootHashMessage): void {
    const {dataSets} = message;

    LoggerProxy.logger.info(
      `HashTreeParser#handleRootHashMessage --> ${
        this.debugId
      } Received heartbeat root hash message with data sets: ${JSON.stringify(
        dataSets.map(({name, root, leafCount, version}) => ({
          name,
          root,
          leafCount,
          version,
        }))
      )}`
    );

    dataSets.forEach((dataSet) => {
      this.updateDataSetInfo(dataSet);
      this.runSyncAlgorithm(dataSet);
    });
  }

  /**
   * Handles updates to Metadata object that we receive from Locus via other means than messages. Right now
   * that means only in the API response alongside locus object.
   *
   * @param {Metadata} metadata received in Locus update other than a message (for example in an API response)
   * @param {HashTreeObject[]} updatedObjects a list of updated hash tree objects to which any updates resulting from new Metadata will be added
   * @returns {void}
   */
  handleMetadataUpdate(metadata: Metadata, updatedObjects: HashTreeObject[]): void {
    let dataSetsRequiringInitialization: VisibleDataSetInfo[] = [];

    // current assumption based on Locus docs is that Metadata object lives always in "self" data set
    const hashTree = this.dataSets[MetadataDataSetName]?.hashTree;

    if (!hashTree) {
      LoggerProxy.logger.warn(
        `HashTreeParser#handleLocusUpdate --> ${this.debugId} received Metadata object but no hash tree for "${MetadataDataSetName}" data set exists`
      );
    } else {
      const metadataUpdated = hashTree.putItem(metadata.htMeta.elementId);

      if (metadataUpdated) {
        // metadata in Locus API response is in a slightly different format than the objects in messages, so need to adapt it
        const metadataObject: HashTreeObject = {
          htMeta: metadata.htMeta,
          data: metadata,
        };

        updatedObjects.push(metadataObject);

        const {changeDetected, removedDataSets, addedDataSets} = this.checkForVisibleDataSetChanges(
          [metadataObject]
        );

        if (changeDetected) {
          dataSetsRequiringInitialization = this.processVisibleDataSetChanges(
            removedDataSets,
            addedDataSets,
            updatedObjects
          );
        }

        if (dataSetsRequiringInitialization.length > 0) {
          // there are some data sets that we need to initialize asynchronously
          queueMicrotask(() => {
            this.initializeNewVisibleDataSets(dataSetsRequiringInitialization);
          });
        }
      }
    }
  }

  /**
   * This method should be called when we receive a partial locus DTO that contains dataSets and htMeta information
   * It updates the hash trees with the new leaf data based on the received Locus
   *
   * @param {Object} update - The locus update containing data sets and locus information
   * @returns {void}
   */
  handleLocusUpdate(update: {dataSets?: Array<DataSet>; locus: any; metadata?: Metadata}): void {
    const {dataSets, locus, metadata} = update;

    if (!dataSets) {
      LoggerProxy.logger.warn(
        `HashTreeParser#handleLocusUpdate --> ${this.debugId} received hash tree update without dataSets`
      );
    }
    for (const dataSet of dataSets) {
      this.updateDataSetInfo(dataSet);
    }
    const updatedObjects: HashTreeObject[] = [];

    // first, analyze the locus object to extract the hash tree objects' htMeta and data from it
    const leafInfo = this.analyzeLocusHtMeta(locus, {copyData: true});

    // if we got metadata, process it (currently that means only potential visible data set list changes)
    if (metadata) {
      this.handleMetadataUpdate(metadata, updatedObjects);
    }

    // then process the data in hash trees, if it is a new version, then add it to updatedObjects
    Object.keys(leafInfo).forEach((dataSetName) => {
      if (this.dataSets[dataSetName]) {
        if (this.dataSets[dataSetName].hashTree) {
          const appliedChangesList = this.dataSets[dataSetName].hashTree.putItems(
            leafInfo[dataSetName].map((leaf) => ({
              id: leaf.id,
              type: leaf.type,
              version: leaf.version,
            }))
          );

          zip(appliedChangesList, leafInfo[dataSetName]).forEach(([changeApplied, leaf]) => {
            if (changeApplied) {
              updatedObjects.push({
                htMeta: {
                  elementId: {
                    type: leaf.type,
                    id: leaf.id,
                    version: leaf.version,
                  },
                  dataSetNames: [dataSetName],
                },
                data: leaf.data,
              });
            }
          });
        } else {
          // no hash tree means that the data set is not visible
          LoggerProxy.logger.warn(
            `HashTreeParser#handleLocusUpdate --> ${this.debugId} received leaf data for data set "${dataSetName}" that has no hash tree created, ignoring`
          );
        }
      } else {
        LoggerProxy.logger.warn(
          `HashTreeParser#handleLocusUpdate --> ${this.debugId} received leaf data for unknown data set "${dataSetName}", ignoring`
        );
      }
    });

    if (updatedObjects.length === 0) {
      LoggerProxy.logger.info(
        `HashTreeParser#handleLocusUpdate --> ${this.debugId} No objects updated as a result of received API response`
      );
    } else {
      this.callLocusInfoUpdateCallback({
        updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
        updatedObjects,
      });
    }
  }

  /**
   * Updates the internal data set information based on the received data set from Locus.
   *
   * @param {DataSet} receivedDataSet - The latest data set information received from Locus to update the internal state.
   * @returns {void}
   */
  private updateDataSetInfo(receivedDataSet: DataSet) {
    if (!this.dataSets[receivedDataSet.name]) {
      this.dataSets[receivedDataSet.name] = {
        ...receivedDataSet,
      };

      LoggerProxy.logger.info(
        `HashTreeParser#updateDataSetInfo --> ${this.debugId} created entry for "${receivedDataSet.name}" dataset: version=${receivedDataSet.version}, root=${receivedDataSet.root}`
      );

      return;
    }
    // update our version of the dataSet
    if (this.dataSets[receivedDataSet.name].version < receivedDataSet.version) {
      this.dataSets[receivedDataSet.name].version = receivedDataSet.version;
      this.dataSets[receivedDataSet.name].root = receivedDataSet.root;
      this.dataSets[receivedDataSet.name].idleMs = receivedDataSet.idleMs;
      this.dataSets[receivedDataSet.name].backoff = {
        maxMs: receivedDataSet.backoff.maxMs,
        exponent: receivedDataSet.backoff.exponent,
      };
      LoggerProxy.logger.info(
        `HashTreeParser#updateDataSetInfo --> ${this.debugId} updated "${receivedDataSet.name}" dataset to version=${receivedDataSet.version}, root=${receivedDataSet.root}`
      );
    }
  }

  /**
   * Checks for changes in the visible data sets based on the updated objects.
   * @param {HashTreeObject[]} updatedObjects - The list of updated hash tree objects.
   * @returns {Object} An object containing the removed and added visible data sets.
   */
  private checkForVisibleDataSetChanges(updatedObjects: HashTreeObject[]) {
    let removedDataSets: VisibleDataSetInfo[] = [];
    let addedDataSets: VisibleDataSetInfo[] = [];

    // visibleDataSets can only be changed by Metadata object updates
    updatedObjects.forEach((object) => {
      if (isMetadata(object) && object.data?.visibleDataSets) {
        const newVisibleDataSets = object.data.visibleDataSets;

        removedDataSets = this.visibleDataSets.filter(
          (ds) => !newVisibleDataSets.some((nvs) => nvs.name === ds.name)
        );
        addedDataSets = newVisibleDataSets.filter((nvs) =>
          this.visibleDataSets.every((ds) => ds.name !== nvs.name)
        );

        if (removedDataSets.length > 0 || addedDataSets.length > 0) {
          LoggerProxy.logger.info(
            `HashTreeParser#checkForVisibleDataSetChanges --> ${
              this.debugId
            } visible data sets change: removed: ${removedDataSets
              .map((ds) => ds.name)
              .join(', ')}, added: ${addedDataSets.map((ds) => ds.name).join(', ')}`
          );
        }
      }
    });

    return {
      changeDetected: removedDataSets.length > 0 || addedDataSets.length > 0,
      removedDataSets,
      addedDataSets,
    };
  }

  /**
   * Deletes the hash tree for the specified data set.
   *
   * @param {string} dataSetName name of the data set to delete
   * @returns {void}
   */
  private deleteHashTree(dataSetName: string) {
    this.dataSets[dataSetName].hashTree = undefined;

    // we also need to stop the timer as there is no hash tree anymore to sync
    if (this.dataSets[dataSetName].timer) {
      clearTimeout(this.dataSets[dataSetName].timer);
      this.dataSets[dataSetName].timer = undefined;
    }
  }

  /**
   * Adds entries to the passed in updateObjects array
   * for the changes that result from removing visible data sets and creates hash
   * trees for the new visible data sets, but without populating the hash trees.
   *
   * This function is synchronous. If we are missing information about some new
   * visible data sets and they require async initialization, the names of these data sets
   * are returned in an array.
   *
   * @param {VisibleDataSetInfo[]} removedDataSets - The list of removed data sets.
   * @param {VisibleDataSetInfo[]} addedDataSets - The list of added data sets.
   * @param {HashTreeObject[]} updatedObjects - The list of updated hash tree objects to which changes will be added.
   * @returns {VisibleDataSetInfo[]} list of data sets that couldn't be initialized synchronously
   */
  private processVisibleDataSetChanges(
    removedDataSets: VisibleDataSetInfo[],
    addedDataSets: VisibleDataSetInfo[],
    updatedObjects: HashTreeObject[]
  ): VisibleDataSetInfo[] {
    const dataSetsRequiringInitialization: VisibleDataSetInfo[] = [];

    // if a visible data set was removed, we need to tell our client that all objects from it are removed
    const removedObjects: HashTreeObject[] = [];

    removedDataSets.forEach((ds) => {
      if (this.dataSets[ds.name]?.hashTree) {
        for (let i = 0; i < this.dataSets[ds.name].hashTree.numLeaves; i += 1) {
          removedObjects.push(
            ...this.dataSets[ds.name].hashTree.getLeafData(i).map((elementId) => ({
              htMeta: {
                elementId,
                dataSetNames: [ds.name],
              },
              data: null,
            }))
          );
        }

        this.deleteHashTree(ds.name);
      }
    });
    this.visibleDataSets = this.visibleDataSets.filter(
      (vds) => !removedDataSets.some((rds) => rds.name === vds.name)
    );
    updatedObjects.push(...removedObjects);

    // now setup the new visible data sets
    for (const ds of addedDataSets) {
      const dataSetInfo = this.dataSets[ds.name];

      if (dataSetInfo) {
        if (this.isVisibleDataSet(dataSetInfo.name)) {
          LoggerProxy.logger.info(
            `HashTreeParser#processVisibleDataSetChanges --> ${this.debugId} Data set "${ds.name}" is already visible, skipping`
          );

          // eslint-disable-next-line no-continue
          continue;
        }

        LoggerProxy.logger.info(
          `HashTreeParser#processVisibleDataSetChanges --> ${this.debugId} Adding visible data set "${ds.name}"`
        );

        this.visibleDataSets.push(ds);

        const hashTree = new HashTree([], dataSetInfo.leafCount);

        this.dataSets[dataSetInfo.name] = {
          ...dataSetInfo,
          hashTree,
        };
      } else {
        LoggerProxy.logger.info(
          `HashTreeParser#processVisibleDataSetChanges --> ${this.debugId} visible data set "${ds.name}" added but no info about it in our dataSets structures`
        );
        // todo: add a metric here
        dataSetsRequiringInitialization.push(ds);
      }
    }

    return dataSetsRequiringInitialization;
  }

  /**
   * Adds entries to the passed in updateObjects array
   * for the changes that result from adding and removing visible data sets.
   *
   * @param {VisibleDataSetInfo[]} addedDataSets - The list of added data sets.
   * @returns {Promise<void>}
   */
  private async initializeNewVisibleDataSets(addedDataSets: VisibleDataSetInfo[]): Promise<void> {
    const allDataSets = await this.getAllVisibleDataSetsFromLocus();

    for (const ds of addedDataSets) {
      const dataSetInfo = allDataSets.find((d) => d.name === ds.name);

      LoggerProxy.logger.info(
        `HashTreeParser#initializeNewVisibleDataSets --> ${this.debugId} initializing data set "${ds.name}"`
      );

      if (!dataSetInfo) {
        LoggerProxy.logger.warn(
          `HashTreeParser#handleHashTreeMessage --> ${this.debugId} missing info about data set "${ds.name}" in Locus response from visibleDataSetsUrl`
        );
      } else {
        // we're awaiting in a loop, because in practice there will be only one new data set at a time,
        // so no point in trying to parallelize this
        // eslint-disable-next-line no-await-in-loop
        const updates = await this.initializeNewVisibleDataSet(ds, dataSetInfo);

        this.callLocusInfoUpdateCallback(updates);
      }
    }
  }

  /**
   * Parses incoming hash tree messages, updates the hash trees and returns information about the changes
   *
   * @param {HashTreeMessage} message - The hash tree message containing data sets and objects to be processed
   * @param {string} [debugText] - Optional debug text to include in logs
   * @returns {Promise}
   */
  private async parseMessage(
    message: HashTreeMessage,
    debugText?: string
  ): Promise<{updateType: LocusInfoUpdateType; updatedObjects?: HashTreeObject[]}> {
    const {dataSets, visibleDataSetsUrl} = message;

    LoggerProxy.logger.info(
      `HashTreeParser#parseMessage --> ${this.debugId} received message ${debugText || ''}:`,
      message
    );
    if (message.locusStateElements?.length === 0) {
      LoggerProxy.logger.warn(
        `HashTreeParser#parseMessage --> ${this.debugId} got empty locusStateElements!!!`
      );
      // todo: send a metric
    }

    // first, update our metadata about the datasets with info from the message
    this.visibleDataSetsUrl = visibleDataSetsUrl;
    dataSets.forEach((dataSet) => this.updateDataSetInfo(dataSet));

    if (this.isEndMessage(message)) {
      LoggerProxy.logger.info(
        `HashTreeParser#parseMessage --> ${this.debugId} received END message`
      );
      this.stopAllTimers();

      return {updateType: LocusInfoUpdateType.MEETING_ENDED};
    }

    let isRosterDropped = false;
    const updatedObjects: HashTreeObject[] = [];

    // when we detect new visible datasets, it may be that the metadata about them is not
    // available in the message, they will require separate async initialization
    let dataSetsRequiringInitialization = [];

    // first find out if there are any visible data set changes - they're signalled in Metadata object updates
    const metadataUpdates = (message.locusStateElements || []).filter((object) =>
      isMetadata(object)
    );

    if (metadataUpdates.length > 0) {
      const updatedMetadataObjects = [];

      metadataUpdates.forEach((object) => {
        // todo: once Locus supports it, we will use the "view" field here instead of dataSetNames
        for (const dataSetName of object.htMeta.dataSetNames) {
          const hashTree = this.dataSets[dataSetName]?.hashTree;

          if (hashTree && object.data) {
            if (hashTree.putItem(object.htMeta.elementId)) {
              updatedMetadataObjects.push(object);
            }
          }
        }
      });

      updatedObjects.push(...updatedMetadataObjects);

      const {changeDetected, removedDataSets, addedDataSets} =
        this.checkForVisibleDataSetChanges(updatedMetadataObjects);

      if (changeDetected) {
        dataSetsRequiringInitialization = this.processVisibleDataSetChanges(
          removedDataSets,
          addedDataSets,
          updatedObjects
        );
      }
    }

    if (message.locusStateElements?.length > 0) {
      // by this point we now have this.dataSets setup for data sets from this message
      // and hash trees created for the new visible data sets,
      // so we can now process all the updates from the message
      dataSets.forEach((dataSet) => {
        if (this.dataSets[dataSet.name]) {
          const {hashTree} = this.dataSets[dataSet.name];

          if (hashTree) {
            const locusStateElementsForThisSet = message.locusStateElements.filter((object) =>
              object.htMeta.dataSetNames.includes(dataSet.name)
            );

            const appliedChangesList = hashTree.updateItems(
              locusStateElementsForThisSet.map((object) =>
                object.data
                  ? {operation: 'update', item: object.htMeta.elementId}
                  : {operation: 'remove', item: object.htMeta.elementId}
              )
            );

            zip(appliedChangesList, locusStateElementsForThisSet).forEach(
              ([changeApplied, object]) => {
                if (changeApplied) {
                  if (isSelf(object) && !object.data) {
                    isRosterDropped = true;
                  }
                  // add to updatedObjects so that our locus DTO will get updated with the new object
                  updatedObjects.push(object);
                }
              }
            );
          } else {
            LoggerProxy.logger.info(
              `Locus-info:index#parseMessage --> ${this.debugId} unexpected (not visible) dataSet ${dataSet.name} received in hash tree message`
            );
          }
        }

        if (!isRosterDropped) {
          this.runSyncAlgorithm(dataSet);
        }
      });
    }

    if (isRosterDropped) {
      LoggerProxy.logger.info(
        `HashTreeParser#parseMessage --> ${this.debugId} detected roster drop`
      );
      this.stopAllTimers();

      // in case of roster drop we don't care about other updates
      return {updateType: LocusInfoUpdateType.MEETING_ENDED};
    }

    if (dataSetsRequiringInitialization.length > 0) {
      // there are some data sets that we need to initialize asynchronously
      queueMicrotask(() => {
        this.initializeNewVisibleDataSets(dataSetsRequiringInitialization);
      });
    }

    if (updatedObjects.length === 0) {
      LoggerProxy.logger.info(
        `HashTreeParser#parseMessage --> ${this.debugId} No objects updated as a result of received message`
      );
    }

    return {updateType: LocusInfoUpdateType.OBJECTS_UPDATED, updatedObjects};
  }

  /**
   * Handles incoming hash tree messages, updates the hash trees and calls locusInfoUpdateCallback
   *
   * @param {HashTreeMessage} message - The hash tree message containing data sets and objects to be processed
   * @param {string} [debugText] - Optional debug text to include in logs
   * @returns {void}
   */
  async handleMessage(message: HashTreeMessage, debugText?: string): Promise<void> {
    if (message.locusStateElements === undefined) {
      this.handleRootHashHeartBeatMessage(message);
    } else {
      const updates = await this.parseMessage(message, debugText);

      this.callLocusInfoUpdateCallback(updates);
    }
  }

  /**
   * Calls the updateInfo callback if there are any updates to report
   *
   * @param {Object} updates parsed from a Locus message
   * @returns {void}
   */
  private callLocusInfoUpdateCallback(updates: {
    updateType: LocusInfoUpdateType;
    updatedObjects?: HashTreeObject[];
  }) {
    const {updateType, updatedObjects} = updates;

    if (updateType === LocusInfoUpdateType.OBJECTS_UPDATED && updatedObjects?.length > 0) {
      // Filter out updates for objects that already have a higher version in their datasets,
      // or removals for objects that still exist in any of their datasets
      const filteredUpdates = updatedObjects.filter((object) => {
        const {elementId} = object.htMeta;
        const {type, id, version} = elementId;

        // Check all datasets
        for (const dataSetName of Object.keys(this.dataSets)) {
          const dataSet = this.dataSets[dataSetName];

          // only visible datasets have hash trees set
          if (dataSet?.hashTree) {
            const existingVersion = dataSet.hashTree.getItemVersion(id, type);
            if (existingVersion !== undefined) {
              if (object.data) {
                // For updates: filter out if any dataset has a higher version
                if (existingVersion > version) {
                  LoggerProxy.logger.info(
                    `HashTreeParser#callLocusInfoUpdateCallback --> ${this.debugId} Filtering out update for ${type}:${id} v${version} because dataset "${dataSetName}" has v${existingVersion}`
                  );

                  return false;
                }
              } else if (existingVersion >= version) {
                // For removals: filter out if the object still exists in any dataset
                LoggerProxy.logger.info(
                  `HashTreeParser#callLocusInfoUpdateCallback --> ${this.debugId} Filtering out removal for ${type}:${id} v${version} because dataset "${dataSetName}" still has v${existingVersion}`
                );

                return false;
              }
            }
          }
        }

        return true;
      });

      if (filteredUpdates.length > 0) {
        this.locusInfoUpdateCallback(updateType, {updatedObjects: filteredUpdates});
      }
    } else if (updateType !== LocusInfoUpdateType.OBJECTS_UPDATED) {
      this.locusInfoUpdateCallback(updateType, {updatedObjects});
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
        `HashTreeParser#runSyncAlgorithm --> ${this.debugId} No data set found for ${receivedDataSet.name}, skipping sync algorithm`
      );

      return;
    }

    if (!dataSet.hashTree) {
      LoggerProxy.logger.info(
        `HashTreeParser#runSyncAlgorithm --> ${this.debugId} Data set "${dataSet.name}" has no hash tree, skipping sync algorithm`
      );

      return;
    }

    dataSet.hashTree.resize(receivedDataSet.leafCount);

    // temporary log for the workshop // todo: remove
    const ourCurrentRootHash = dataSet.hashTree.getRootHash();
    LoggerProxy.logger.info(
      `HashTreeParser#runSyncAlgorithm --> ${this.debugId} dataSet="${dataSet.name}" version=${dataSet.version} hashes before starting timer: ours=${ourCurrentRootHash} Locus=${dataSet.root}`
    );

    const delay = dataSet.idleMs + this.getWeightedBackoffTime(dataSet.backoff);

    if (delay > 0) {
      if (dataSet.timer) {
        clearTimeout(dataSet.timer);
      }

      LoggerProxy.logger.info(
        `HashTreeParser#runSyncAlgorithm --> ${this.debugId} setting "${dataSet.name}" sync timer for ${delay}`
      );

      dataSet.timer = setTimeout(async () => {
        dataSet.timer = undefined;

        if (!dataSet.hashTree) {
          LoggerProxy.logger.warn(
            `HashTreeParser#runSyncAlgorithm --> ${this.debugId} Data set "${dataSet.name}" no longer has a hash tree, cannot run sync algorithm`
          );

          return;
        }

        const rootHash = dataSet.hashTree.getRootHash();

        if (dataSet.root !== rootHash) {
          LoggerProxy.logger.info(
            `HashTreeParser#runSyncAlgorithm --> ${this.debugId} Root hash mismatch: received=${dataSet.root}, ours=${rootHash}, syncing data set "${dataSet.name}"`
          );

          const mismatchedLeavesData: Record<number, LeafDataItem[]> = {};

          if (dataSet.leafCount !== 1) {
            let receivedHashes;

            try {
              // request hashes from sender
              const {hashes, dataSet: latestDataSetInfo} = await this.getHashesFromLocus(
                dataSet.name,
                rootHash
              );

              receivedHashes = hashes;

              dataSet.hashTree.resize(latestDataSetInfo.leafCount);
            } catch (error) {
              if (error.statusCode === 409) {
                // this is a leaf count mismatch, we should do nothing, just wait for another heartbeat message from Locus
                LoggerProxy.logger.info(
                  `HashTreeParser#getHashesFromLocus --> ${this.debugId} Got 409 when fetching hashes for data set "${dataSet.name}": ${error.message}`
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
            const syncResponse = await this.sendSyncRequestToLocus(dataSet, mismatchedLeavesData);

            // sync API may return nothing (in that case data will arrive via messages)
            // or it may return a response in the same format as messages
            if (syncResponse) {
              this.handleMessage(syncResponse, 'via sync API');
            }
          }
        } else {
          LoggerProxy.logger.info(
            `HashTreeParser#runSyncAlgorithm --> ${this.debugId} "${dataSet.name}" root hash matching: ${rootHash}, version=${dataSet.version}`
          );
        }
      }, delay);
    } else {
      LoggerProxy.logger.info(
        `HashTreeParser#runSyncAlgorithm --> ${this.debugId} No delay for "${dataSet.name}" data set, skipping sync timer reset/setup`
      );
    }
  }

  /**
   * Stops all timers for the data sets to prevent any further sync attempts.
   * @returns {void}
   */
  private stopAllTimers() {
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
   * @param {string} currentRootHash
   * @returns {string[]}
   */
  private getHashesFromLocus(dataSetName: string, currentRootHash: string) {
    LoggerProxy.logger.info(
      `HashTreeParser#getHashesFromLocus --> ${this.debugId} Requesting hashes for data set "${dataSetName}"`
    );

    const dataSet = this.dataSets[dataSetName];

    const url = `${dataSet.url}/hashtree`;

    return this.webexRequest({
      method: HTTP_VERBS.GET,
      uri: url,
      qs: {
        rootHash: currentRootHash,
      },
    })
      .then((response) => {
        const hashes = response.body?.hashes as string[] | undefined;
        const dataSetFromResponse = response.body?.dataSet;

        if (!hashes || !Array.isArray(hashes)) {
          LoggerProxy.logger.warn(
            `HashTreeParser#getHashesFromLocus --> ${this.debugId} Locus returned invalid hashes, response body=`,
            response.body
          );
          throw new Error(`Locus returned invalid hashes: ${hashes}`);
        }

        LoggerProxy.logger.info(
          `HashTreeParser#getHashesFromLocus --> ${
            this.debugId
          } Received hashes for data set "${dataSetName}": ${JSON.stringify(hashes)}`
        );

        return {
          hashes,
          dataSet: dataSetFromResponse as DataSet,
        };
      })
      .catch((error) => {
        LoggerProxy.logger.error(
          `HashTreeParser#getHashesFromLocus --> ${this.debugId} Error ${error.statusCode} fetching hashes for data set "${dataSetName}":`,
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
   * @returns {Promise<HashTreeMessage|null>}
   */
  private sendSyncRequestToLocus(
    dataSet: InternalDataSet,
    mismatchedLeavesData: Record<number, LeafDataItem[]>
  ): Promise<HashTreeMessage | null> {
    LoggerProxy.logger.info(
      `HashTreeParser#sendSyncRequestToLocus --> ${this.debugId} Sending sync request for data set "${dataSet.name}"`
    );

    const url = `${dataSet.url}/sync`;
    const body = {
      leafCount: dataSet.leafCount,
      leafDataEntries: [],
    };

    Object.keys(mismatchedLeavesData).forEach((index) => {
      body.leafDataEntries.push({
        leafIndex: parseInt(index, 10),
        elementIds: mismatchedLeavesData[index],
      });
    });

    const ourCurrentRootHash = dataSet.hashTree ? dataSet.hashTree.getRootHash() : EMPTY_HASH;

    return this.webexRequest({
      method: HTTP_VERBS.POST,
      uri: url,
      qs: {
        rootHash: ourCurrentRootHash,
      },
      body,
    })
      .then((resp) => {
        LoggerProxy.logger.info(
          `HashTreeParser#sendSyncRequestToLocus --> ${this.debugId} Sync request succeeded for "${dataSet.name}"`
        );

        if (!resp.body || isEmpty(resp.body)) {
          LoggerProxy.logger.info(
            `HashTreeParser#sendSyncRequestToLocus --> ${this.debugId} Got ${resp.statusCode} with empty body for sync request for data set "${dataSet.name}", data should arrive via messages`
          );

          return null;
        }

        return resp.body as HashTreeMessage;
      })
      .catch((error) => {
        LoggerProxy.logger.error(
          `HashTreeParser#sendSyncRequestToLocus --> ${this.debugId} Error ${error.statusCode} sending sync request for data set "${dataSet.name}":`,
          error
        );
        throw error;
      });
  }
}

export default HashTreeParser;
