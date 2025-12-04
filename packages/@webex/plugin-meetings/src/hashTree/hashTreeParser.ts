import {Enum} from '../constants';
import {ObjectType, HtMeta} from './types';
import {LocusDTO} from '../locus-info/types';

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

export interface HashTreeObject {
  htMeta: HtMeta;
  data: Record<string, any>;
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

interface InternalDataSet extends DataSet {
  // hashTree?: HashTree; // set only for visible data sets
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
 * This error is thrown if we receive information that the meeting has ended while we're processing some hash messages.
 * It's handled internally by HashTreeParser and results in MEETING_ENDED being sent up.
 */
class MeetingEndedError extends Error {}

/**
 * Checks if the given hash tree object is of type "self"
 * @param {HashTreeObject} object object to check
 * @returns {boolean} True if the object is of type "self", false otherwise
 */
export function isSelf(object: HashTreeObject) {
  return object.htMeta.elementId.type.toLowerCase() === ObjectType.self;
}

/**
 * Parses hash tree eventing locus data
 */
class HashTreeParser {
  dataSets: Record<string, InternalDataSet> = {};
  visibleDataSetsUrl: string; // url from which we can get info about all data sets
  webexRequest: WebexRequestMethod;
  locusInfoUpdateCallback: LocusInfoUpdateCallback;
  visibleDataSets: string[];
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
    webexRequest: WebexRequestMethod;
    locusInfoUpdateCallback: LocusInfoUpdateCallback;
    debugId: string;
  }) {
    const {locus} = options.initialLocus;

    this.debugId = options.debugId;
    this.webexRequest = options.webexRequest;
    this.locusInfoUpdateCallback = options.locusInfoUpdateCallback;
    this.visibleDataSets = locus?.self?.visibleDataSets || [];
  }

  /**
   * Initializes the hash tree parser from a message received from Locus.
   *
   * @param {HashTreeMessage} message - initial hash tree message received from Locus
   * @returns {Promise}
   */
  async initializeFromMessage(message: HashTreeMessage) {
    // todo
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
    // todo
  }

  /**
   * This method should be called when we receive a partial locus DTO that contains dataSets and htMeta information
   * It updates the hash trees with the new leaf data based on the received Locus
   *
   * @param {Object} update - The locus update containing data sets and locus information
   * @returns {void}
   */
  handleLocusUpdate(update: {dataSets?: Array<DataSet>; locus: any}): void {
    // todo
  }

  /**
   * Handles incoming hash tree messages, updates the hash trees and calls locusInfoUpdateCallback
   *
   * @param {HashTreeMessage} message - The hash tree message containing data sets and objects to be processed
   * @param {string} [debugText] - Optional debug text to include in logs
   * @returns {void}
   */
  async handleMessage(message: HashTreeMessage, debugText?: string): Promise<void> {
    // todo
  }
}

export default HashTreeParser;
