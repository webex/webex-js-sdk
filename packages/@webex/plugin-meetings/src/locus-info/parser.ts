import {difference} from 'lodash';

import SortedQueue from '../common/queue';
import LoggerProxy from '../common/logs/logger-proxy';

import Metrics from '../metrics';
import BEHAVIORAL_METRICS from '../metrics/constants';

const MAX_OOO_DELTA_COUNT = 5; // when we receive an out-of-order delta and the queue builds up to MAX_OOO_DELTA_COUNT, we do a sync with Locus
const OOO_DELTA_WAIT_TIME = 10000; // [ms] minimum wait time before we do a sync if we get out-of-order deltas
const OOO_DELTA_WAIT_TIME_RANDOM_DELAY = 5000; // [ms] max random delay added to OOO_DELTA_WAIT_TIME

type LocusDeltaDto = {
  url: string;
  baseSequence: {
    rangeStart: number;
    rangeEnd: number;
    entries: number[];
  };
  sequence: {
    rangeStart: number;
    rangeEnd: number;
    entries: number[];
  };
  syncUrl: string;
};

/**
 * Locus Delta Parser
 * @private
 * https://sqbu-github.cisco.com/WebExSquared/cloud-apps/wiki/Locus-Delta-Events
 */
export default class Parser {
  // processing status
  status:
    | 'IDLE' // not doing anything
    | 'PAUSED' // paused, because we are doing a sync
    | 'WORKING' // processing a delta event
    | 'BLOCKED'; // received an out-of-order delta, so waiting for the missing one

  // loci comparison states
  static loci = {
    EQ: 'EQUAL',
    GT: 'GREATER_THAN',
    LT: 'LESS_THAN',
    DESYNC: 'DESYNC',
    USE_INCOMING: 'USE_INCOMING',
    USE_CURRENT: 'USE_CURRENT',
    WAIT: 'WAIT',
    ERROR: 'ERROR',
    LOCUS_URL_CHANGED: 'LOCUS_URL_CHANGED',
  };

  queue: SortedQueue<LocusDeltaDto>;
  workingCopy: any;
  syncTimer?: ReturnType<typeof setTimeout>;

  /**
   * @constructs Parser
   */
  constructor() {
    const deltaCompareFunc = (left: LocusDeltaDto, right: LocusDeltaDto) => {
      const {LT, GT} = Parser.loci;
      const {extractComparisonState: extract} = Parser;

      if (Parser.isSequenceEmpty(left)) {
        return -1;
      }
      if (Parser.isSequenceEmpty(right)) {
        return 1;
      }
      const result = extract(Parser.compareSequence(left.baseSequence, right.baseSequence));

      if (result === LT) {
        return -1;
      }
      if (result === GT) {
        return 1;
      }

      return 0;
    };

    this.queue = new SortedQueue<LocusDeltaDto>(deltaCompareFunc);
    this.status = 'IDLE';
    this.onDeltaAction = null;
    this.workingCopy = null;
    this.syncTimer = undefined;
  }

  /**
   * Returns a debug string representing a locus delta - useful for logging
   *
   * @param {LocusDeltaDto} locus Locus delta
   * @returns {string}
   */
  static locus2string(locus: LocusDeltaDto) {
    if (!locus.sequence?.entries) {
      return 'invalid';
    }

    return locus.sequence.entries.length ? `seq=${locus.sequence.entries.at(-1)}` : 'empty';
  }

  /**
   * Checks if two sequences overlap in time,
   * the sequence with the higher minimum value is greater.
   * Chooses sequence with most recent data.
   * @param {Types~Locus} current
   * @param {Types~Locus} incoming
   * @returns {string} loci comparison state
   */
  static checkSequenceOverlap(current, incoming) {
    let comparison = null;

    // if earliest working copy sequence is more recent than last incoming sequence
    if (current.min > incoming.max) {
      // choose left side (current)
      comparison = `${Parser.loci.GT}:SO001`;
    }
    // if last working copy sequence is before the earliest incoming sequence
    else if (current.max < incoming.min) {
      // choose right side (incoming)
      comparison = `${Parser.loci.LT}:SO002`;
    }

    // if no match above, defaults to null
    return comparison;
  }

  /**
   * Checks if two sequences have unequal ranges.
   * Chooses sequence with most larger range.
   * @param {Types~Locus} current
   * @param {Types~Locus} incoming
   * @returns {object} loci comparison
   */
  static checkUnequalRanges(current, incoming) {
    let comparison = null;
    const currentIsNotUnique = current.unique.length === 0;
    const incomingIsNotUnique = incoming.unique.length === 0;
    const currentTotalRange = current.end - current.min;
    const incomingTotalRange = incoming.end - incoming.min;

    // no unique values for both loci
    if (currentIsNotUnique && incomingIsNotUnique) {
      // current working copy loci has a larger range
      if (currentTotalRange > incomingTotalRange) {
        // choose left side (current)
        comparison = `${Parser.loci.GT}:UR001`;
      }
      // incoming delta loci has a larger range
      else if (currentTotalRange < incomingTotalRange) {
        // choose right side (incoming)
        comparison = `${Parser.loci.LT}:UR002`;
      } else {
        // with no unique entries and with ranges either absent or
        // of the same size, the sequences are considered equal.
        comparison = `${Parser.loci.EQ}:UR003`;
      }
    }

    return comparison;
  }

  /**
   * Checks if either sequences has unique entries.
   * Entries are considered unique if they do not overlap
   * with other Loci sequences or range values.
   * Chooses sequence with the unique entries.
   * @param {Types~Locus} current
   * @param {Types~Locus} incoming
   * @returns {string} loci comparison state
   */
  static checkForUniqueEntries(current, incoming) {
    let comparison = null;
    const currentIsUnique = current.unique.length > 0;
    const incomingIsUnique = incoming.unique.length > 0;

    // current has unique entries and incoming does not
    if (currentIsUnique && !incomingIsUnique) {
      // choose left side (current)
      comparison = `${Parser.loci.GT}:UE001`;
    }
    // current has no unique entries but incoming does
    else if (!currentIsUnique && incomingIsUnique) {
      // choose right side (incoming)
      comparison = `${Parser.loci.LT}:UE002`;
    }

    return comparison;
  }

  /**
   * Checks both Locus Delta objects to see if they are
   * out of sync with one another. If so sends a DESYNC
   * request to the server.
   * @param {Types~Locus} current
   * @param {Types~Locus} incoming
   * @returns {string} loci comparison state
   */
  static checkIfOutOfSync(current, incoming) {
    let comparison = null;
    const currentUniqueMin = current.unique[0];
    const incomingUniqueMin = incoming.unique[0];

    const currentHasNoRange = !current.start && !current.end;
    const incomingHasNoRange = !incoming.start && !incoming.end;
    const neitherSeqHasRange = currentHasNoRange && incomingHasNoRange;

    const hasUniqOverlap = (list, min, max) => list.some((seq) => min < seq && seq < max);
    // current unique entries overlap the total range of incoming
    const currentUniqOverlap = hasUniqOverlap(current.unique, incoming.min, incoming.max);
    // vice-versa, incoming unique entries overlap the total range of current
    const incomingUniqOverlap = hasUniqOverlap(incoming.unique, current.min, current.max);

    if (neitherSeqHasRange || currentUniqOverlap || incomingUniqOverlap) {
      // outputs string indicating which condition occurred. ex: 0,1,0
      const debugInfo = `${+neitherSeqHasRange},${+currentUniqOverlap},${+incomingUniqOverlap}`;

      // send DESYNC to server
      comparison = `${Parser.loci.DESYNC}:OOS001:${debugInfo}`;
    } else if (currentUniqueMin > incomingUniqueMin) {
      // choose left side (current)
      comparison = `${Parser.loci.GT}:OOS002`;
    } else {
      // choose right side (incoming)
      comparison = `${Parser.loci.LT}:OOS003`;
    }

    return comparison;
  }

  /**
   * Compares two loci to determine which one contains the most recent state
   * @instance
   * @memberof Locus
   * @param {Types~Locus} current
   * @param {Types~Locus} incoming
   * @returns {string} loci comparison state
   */
  static compare(current, incoming) {
    const {isSequenceEmpty} = Parser;
    const {extractComparisonState: extract} = Parser;
    const {packComparisonResult: pack} = Parser;

    if (isSequenceEmpty(current) || isSequenceEmpty(incoming)) {
      return pack(Parser.loci.USE_INCOMING, 'C001');
    }

    if (incoming.baseSequence) {
      return pack(Parser.compareDelta(current, incoming), 'C002');
    }

    const result = Parser.compareSequence(current.sequence, incoming.sequence);
    const action = Parser.compareToAction(extract(result));

    return pack(action, result);
  }

  /**
   * Compares two loci sequences (with delta params) and indicates what action
   * to take.
   * @instance
   * @memberof Locus
   * @param {Types~Locus} current
   * @param {Types~Locus} incoming
   * @private
   * @returns {string} loci comparison state
   */
  private static compareDelta(current, incoming) {
    const {LT, GT, EQ, DESYNC, USE_INCOMING, WAIT, LOCUS_URL_CHANGED} = Parser.loci;

    const {extractComparisonState: extract} = Parser;
    const {packComparisonResult: pack} = Parser;

    const result = Parser.compareSequence(current.sequence, incoming.sequence);
    let comparison = extract(result);

    if (comparison !== LT) {
      return pack(Parser.compareToAction(comparison), result);
    }

    if (incoming.url !== current.url) {
      // when moving to/from a breakout session, the locus URL will change and also
      // the baseSequence, making incoming and current incomparable, so use a
      // unique comparison state
      return pack(LOCUS_URL_CHANGED, result);
    }

    comparison = Parser.compareSequence(current.sequence, incoming.baseSequence);

    switch (extract(comparison)) {
      case GT:
      case EQ:
        comparison = USE_INCOMING;
        break;

      case LT:
        if (extract(Parser.compareSequence(incoming.baseSequence, incoming.sequence)) === EQ) {
          // special case where Locus sends a delta with baseSequence === sequence to trigger a sync,
          // because the delta event is too large to be sent over mercury connection
          comparison = DESYNC;
        } else {
          // the incoming locus has baseSequence from the future, so it is out-of-order,
          // we are missing 1 or more locus that should be in front of it, we need to wait for it
          comparison = WAIT;

          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.LOCUS_DELTA_OUT_OF_ORDER, {
            stack: new Error().stack,
          });
        }
        break;
      default:
        comparison = DESYNC;
    }

    return pack(comparison, result);
  }

  /**
   * Compares Locus sequences - it should be called only for full Locus DTOs, not deltas
   *
   * @param {Types~Locus} current Current working copy
   * @param {Types~Locus} incomingFullDto New Full Locus DTO
   * @returns {string} either Parser.loci.USE_INCOMING or Parser.loci.USE_CURRENT
   */
  static compareFullDtoSequence(current, incomingFullDto) {
    if (Parser.isSequenceEmpty(current) || Parser.isSequenceEmpty(incomingFullDto)) {
      return Parser.loci.USE_INCOMING;
    }

    // the sequence.entries list will always contain at least 1 entry
    // https://sqbu-github.cisco.com/WebExSquared/cloud-apps/wiki/Locus-Sequence-Comparison-Algorithm

    return incomingFullDto.sequence.entries.slice(-1)[0] > current.sequence.entries.slice(-1)[0]
      ? Parser.loci.USE_INCOMING
      : Parser.loci.USE_CURRENT;
  }

  /**
   * Returns true if the incoming full locus DTO is newer than the current working copy
   *
   * @param {Types~Locus} incomingFullDto New Full Locus DTO
   * @returns {string} either Parser.loci.USE_INCOMING or Parser.loci.USE_CURRENT
   */
  isNewFullLocus(incomingFullDto) {
    if (!Parser.isLoci(incomingFullDto)) {
      LoggerProxy.logger.info('Locus-info:parser#isNewFullLocus --> Ignoring non-locus object.');

      return false;
    }

    if (!this.workingCopy) {
      // we don't have a working copy yet, so any full locus is better than nothing
      return true;
    }

    const comparisonResult = Parser.compareFullDtoSequence(this.workingCopy, incomingFullDto);

    return comparisonResult === Parser.loci.USE_INCOMING;
  }

  /**
   * Compares Locus sequences
   * @param {Types~Locus} current Current working copy
   * @param {Types~Locus} incoming New Locus delta
   * @returns {string}
   */
  static compareSequence(current, incoming) {
    // Locus sequence comparison rules in order of priority.
    // https://sqbu-github.cisco.com/WebExSquared/cloud-apps/wiki/Locus-Sequence-Comparison-Algorithm

    const local: any = Parser.getMetaData(current);
    const delta: any = Parser.getMetaData(incoming);

    // update loci metadata
    local.unique = Parser.getUniqueSequences(local, delta);
    delta.unique = Parser.getUniqueSequences(delta, local);

    // Locus sequence comparison rules
    // order matters
    const rules = [
      Parser.checkSequenceOverlap,
      Parser.checkUnequalRanges,
      Parser.checkForUniqueEntries,
      Parser.checkIfOutOfSync,
    ];

    for (const rule of rules) {
      // Rule only returns a value if the rule applies,
      // otherwise returns null.
      const result = rule(local, delta);

      if (result) {
        return result;
      }
    }

    // error, none of rules above applied
    // should never get here as last rule
    // should be catch all.
    return Parser.loci.ERROR;
  }

  /**
   * Transates the result of a sequence comparison into an intended behavior
   * @param {string} result
   * @returns {string} Locus comparison action
   */
  static compareToAction(result: string) {
    const {DESYNC, EQ, ERROR, GT, LT, USE_CURRENT, USE_INCOMING} = Parser.loci;

    let action = ERROR;

    switch (result) {
      case EQ:
      case GT:
        action = USE_CURRENT;
        break;
      case LT:
        action = USE_INCOMING;
        break;
      case DESYNC:
        action = DESYNC;
        break;
      default:
        LoggerProxy.logger.info(
          `Locus-info:parser#compareToAction --> Error: ${result} is not a recognized sequence comparison result.`
        );
    }

    return action;
  }

  /**
   * Extracts a loci comparison from a string of data.
   * @param {string} lociComparisonResult Comparison result with extra data
   * @returns {string} Comparison of EQ, LT, GT, or DESYNC.
   */
  static extractComparisonState(lociComparisonResult: string) {
    return lociComparisonResult.split(':')[0];
  }

  /**
   * @typedef {object} LociMetadata
   * @property {number} start - Starting sequence number
   * @property {number} end - Ending sequence number
   * @property {number} first - First sequence number
   * @property {number} last - Last sequence number
   * @property {number} min - Minimum sequence number
   * @property {number} max - Maximum sequence number
   * @property {number} entries - Loci sequence entries
   */

  /**
   * Metadata for Locus delta
   * @param {Array.<number>} sequence Locus delta sequence
   * @returns {LociMetadata} Locus Delta Metadata
   */
  static getMetaData(sequence: any) {
    const {entries} = sequence;
    const first = entries[0];
    const last = entries.slice(-1)[0];

    // rangeStart or rangeEnd is 0 if a range doesn't exist
    const start = sequence.rangeStart;
    const end = sequence.rangeEnd;

    // sequence data
    return {
      start,
      end,
      first,
      last,
      // Rule is: rangeStart <= rangeEnd <= min(entries)
      min: start || first,
      // Grab last entry if exist else default to rangeEnd
      max: last || end,
      // keep reference to actual sequence entries
      entries,
    };
  }

  /**
   * Compares two Locus delta objects and notes unique
   * values contained within baseLoci.
   * @param {LociMetadata} baseLoci
   * @param {LociMetadata} otherLoci
   * @returns {Array.<number>} List of unique sequences
   */
  static getUniqueSequences(baseLoci: any, otherLoci: any) {
    const diff: any = difference(baseLoci.entries, otherLoci.entries);

    const {start, end} = otherLoci;

    return Parser.getNumbersOutOfRange(diff, start, end);
  }

  /**
   * Returns an array of numbers outside of a given range.
   * @param {Array.<number>} list Array to filter
   * @param {number} rangeStart Start of range
   * @param {number} rangeEnd End of range
   * @returns {Array.<number>} Array of numbers sorted ASC
   */
  static getNumbersOutOfRange(list: Array<number>, rangeStart: number, rangeEnd: number) {
    // Collect all numbers if number is outside of specified range
    const output = list.filter((num) => num < rangeStart || num > rangeEnd);

    // sort ascending
    return output.sort((a, b) => a - b);
  }

  /**
   * Checks if newLoci or workingCopy is invalid.
   * @param {Types~Locus} newLoci
   * @returns {boolean}
   */
  isValidLocus(newLoci) {
    let isValid = false;
    const {isLoci} = Parser;

    // one or both objects are not locus delta events
    if (!isLoci(this.workingCopy) || !isLoci(newLoci)) {
      LoggerProxy.logger.info(
        'Locus-info:parser#processDeltaEvent --> Ignoring non-locus object. workingCopy:',
        this.workingCopy,
        'newLoci:',
        newLoci
      );
    } else {
      isValid = true;
    }

    return isValid;
  }

  /**
   * Determines if a paricular locus's sequence is empty
   * @param {Types~Locus} locus
   * @returns {bool}
   */
  static isSequenceEmpty(locus) {
    const {sequence} = locus;
    const hasEmptyEntries = !sequence.entries?.length;
    const hasEmptyRange = sequence.rangeStart === 0 && sequence.rangeEnd === 0;

    return hasEmptyEntries && hasEmptyRange;
  }

  /**
   * Determines if an object has basic
   * structure of a locus object.
   * @param {Types~Locus} loci
   * @returns {boolean}
   */
  static isLoci(loci) {
    if (!loci || !loci.sequence) {
      return false;
    }
    const hasProp = (prop) => Object.prototype.hasOwnProperty.call(loci.sequence, prop);

    if (hasProp('rangeStart') && hasProp('rangeEnd')) {
      return true;
    }

    return false;
  }

  /**
   * Processes next event in queue,
   * if queue is empty sets status to idle.
   * @returns {undefined}
   */
  nextEvent() {
    if (this.status === 'PAUSED') {
      LoggerProxy.logger.info('Locus-info:parser#nextEvent --> Locus parser paused.');

      return;
    }

    if (this.status === 'BLOCKED') {
      LoggerProxy.logger.info(
        'Locus-info:parser#nextEvent --> Locus parser blocked by out-of-order delta.'
      );

      return;
    }

    // continue processing until queue is empty
    if (this.queue.size() > 0) {
      this.processDeltaEvent();
    } else {
      this.status = 'IDLE';
    }
  }

  /**
   * Function handler for delta actions,
   * is set by instance callee.
   * @param {string} action Locus delta action
   * @param {Types~Locus} locus Locus delta
   * @returns {undefined}
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onDeltaAction(action: string, locus) {}

  /**
   * Event handler for locus delta events
   * @param {Types~Locus} loci Locus Delta
   * @returns {undefined}
   */
  onDeltaEvent(loci) {
    // enqueue the new loci
    this.queue.enqueue(loci);

    if (this.onDeltaAction) {
      if (this.status === 'BLOCKED') {
        if (this.queue.size() > MAX_OOO_DELTA_COUNT) {
          this.triggerSync('queue too big, blocked on out-of-order delta');
        } else {
          this.processDeltaEvent();
        }
      } else if (this.status === 'IDLE') {
        // Update status, ensure we only process one event at a time.
        this.status = 'WORKING';

        this.processDeltaEvent();
      }
    }
  }

  /**
   * Appends new data onto a string of existing data.
   * @param {string} newData
   * @param {string} oldData
   * @returns {string}
   */
  static packComparisonResult(newData: string, oldData: string) {
    return `${newData}:${oldData}`;
  }

  /**
   * Pause locus processing
   * @returns {undefined}
   */
  pause() {
    this.status = 'PAUSED';
    LoggerProxy.logger.info('Locus-info:parser#pause --> Locus parser paused.');
  }

  /**
   * Triggers a sync with Locus
   *
   * @param {string} reason used just for logging
   * @returns {undefined}
   */
  private triggerSync(reason: string) {
    LoggerProxy.logger.info(`Locus-info:parser#triggerSync --> doing sync, reason: ${reason}`);
    this.stopSyncTimer();
    this.pause();
    this.onDeltaAction(Parser.loci.DESYNC, this.workingCopy);
  }

  /**
   * Starts a timer with a random delay. When that timer expires we will do a sync.
   *
   * The main purpose of this timer is to handle a case when we get some out-of-order deltas,
   * so we start waiting to receive the missing delta. If that delta never arrives, this timer
   * will trigger a sync with Locus.
   *
   * @returns {undefined}
   */
  private startSyncTimer() {
    if (this.syncTimer === undefined) {
      const timeout = OOO_DELTA_WAIT_TIME + Math.random() * OOO_DELTA_WAIT_TIME_RANDOM_DELAY;

      this.syncTimer = setTimeout(() => {
        this.syncTimer = undefined;
        this.triggerSync('timer expired, blocked on out-of-order delta');
      }, timeout);
    }
  }

  /**
   * Stops the timer for triggering a sync
   *
   * @returns {undefined}
   */
  private stopSyncTimer() {
    if (this.syncTimer !== undefined) {
      clearTimeout(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Processes next locus delta in the queue,
   * continues until the queue is empty
   * or cleared.
   * @returns {undefined}
   */
  processDeltaEvent() {
    const {DESYNC, USE_INCOMING, WAIT, LOCUS_URL_CHANGED} = Parser.loci;
    const {extractComparisonState: extract} = Parser;
    const newLoci = this.queue.dequeue();

    if (!this.isValidLocus(newLoci)) {
      this.nextEvent();

      return;
    }

    const result = Parser.compare(this.workingCopy, newLoci);
    const lociComparison = extract(result);

    // limited debugging, use chrome extension
    // for full debugging.
    LoggerProxy.logger.debug(`Locus-info:parser#processDeltaEvent --> Locus Debug: ${result}`);

    let needToWait = false;

    switch (lociComparison) {
      case DESYNC:
        // wait for desync response
        this.pause();
        break;

      case USE_INCOMING:
      case LOCUS_URL_CHANGED:
        // update working copy for future comparisons.
        // Note: The working copy of parser gets updated in .onFullLocus()
        // and here when USE_INCOMING or LOCUS_URL_CHANGED locus.
        this.workingCopy = newLoci;
        break;

      case WAIT:
        // we've taken newLoci from the front of the queue, so put it back there as we have to wait
        // for the one that should be in front of it, before we can process it
        this.queue.enqueue(newLoci);
        needToWait = true;
        break;

      default:
        break;
    }

    if (needToWait) {
      this.status = 'BLOCKED';
      this.startSyncTimer();
    } else {
      this.stopSyncTimer();

      if (this.status === 'BLOCKED') {
        // we are not blocked anymore
        this.status = 'WORKING';

        LoggerProxy.logger.info(
          `Locus-info:parser#processDeltaEvent --> received delta that we were waiting for ${Parser.locus2string(
            newLoci
          )}, not blocked anymore`
        );
      }
    }

    if (this.onDeltaAction) {
      LoggerProxy.logger.info(
        `Locus-info:parser#processDeltaEvent --> Locus Delta ${Parser.locus2string(
          newLoci
        )}, Action: ${lociComparison}`
      );

      this.onDeltaAction(lociComparison, newLoci);
    }

    this.nextEvent();
  }

  /**
   * Resume from a paused state
   * @returns {undefined}
   */
  resume() {
    LoggerProxy.logger.info('Locus-info:parser#resume --> Locus parser resumed.');
    this.status = 'WORKING';
    this.nextEvent();
  }

  /**
   * Gets related debug info for given error code
   * @param {string} debugCode Debug code
   * @param {string} comparison Locus comparison string
   * @returns {object} Debug message
   */
  static getDebugMessage(debugCode: string, comparison: string) {
    // removes extra spaces from multiline string
    const mStr = (strings) => strings.join('').replace(/\s{2,}/g, ' ');

    const resolutionMap = {
      EQ: `${Parser.loci.LT}: is equal (current == incoming).`,
      LT: `${Parser.loci.LT}: choose right side (incoming).`,
      GT: `${Parser.loci.GT}: choose left side (current).`,
    };

    const debugMap = {
      SO001: {
        title: 'checkSequenceOverlap-001',
        description: mStr`Occurs if earliest working copy sequence is more \
            recent than last incoming sequence.`,
        logic: 'current.min > incoming.max',
      },

      SO002: {
        title: 'checkSequenceOverlap-002',
        description: mStr`Occurs if last working copy sequence is before the \
          earliest incoming sequence.`,
        logic: 'current.max < incoming.min',
      },

      UR001: {
        title: 'checkUnequalRanges-001',
        description: mStr`Occurs if there are no unique values for both loci, \
          and the current working copy loci has a larger range.`,
        logic: 'currentTotalRange > incomingTotalRange',
      },

      UR002: {
        title: 'checkUnequalRanges-002',
        description: mStr`Occurs if there are no unique values for both loci, \
          and the incoming delta loci has a larger range.`,
        logic: 'currentTotalRange < incomingTotalRange',
      },

      UR003: {
        title: 'checkUnequalRanges-003',
        description: mStr`Occurs if there are no unique values for both loci, \
          and with ranges either absent or of the same size, the sequences \
          are considered equal.`,
        logic: 'currentTotalRange == incomingTotalRange',
      },

      UE001: {
        title: 'checkForUniqueEntries-001',
        description: mStr`Occurs if current loci has unique entries and \
          incoming does not. Entries are considered unique if they \
          do not overlap with other Loci sequences or range values.`,
        logic: 'currentIsUnique && !incomingIsUnique',
      },

      UE002: {
        title: 'checkForUniqueEntries-002',
        description: mStr`Occurs if current has no unique entries but \
          incoming does. Entries are considered unique if they \
          do not overlap with other Loci sequences or range values.`,
        logic: '!currentIsUnique && incomingIsUnique',
      },

      OOS001: {
        title: 'checkIfOutOfSync-001',
        description: mStr`Occurs if neither sequence has a range, or \
          if the current loci unique entries overlap the total range of the \
          incoming sequence, or if the incoming unique entries overlap \
          the total range of current sequence.`,
        logic: 'neitherSeqHasRange || currentUniqOverlap || incomingUniqOverlap',
      },

      OOS002: {
        title: 'checkIfOutOfSync-002',
        description: mStr`Occurs if the minimum value from sequences that are \
          unique to the current loci is greater than the minimum value from \
          sequences that are unique to the incoming loci.`,
        logic: 'currentUniqueMin > incomingUniqueMin',
      },

      OOS003: {
        title: 'checkIfOutOfSync-003',
        description: mStr`Occurs if none of the comparison rules applied. \
          It is a catch all.`,
        logic: 'else (catch all)',
      },
    };

    const debugObj = debugMap[debugCode];

    debugObj.title = `Debug: ${debugObj.title}`;
    debugObj.resolution = resolutionMap[comparison];

    return debugObj;
  }
}
