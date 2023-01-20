import {difference} from 'lodash';

import SimpleQueue from '../common/queue';
import LoggerProxy from '../common/logs/logger-proxy';

/**
 * Locus Delta Parser
 * @private
 * https://sqbu-github.cisco.com/WebExSquared/cloud-apps/wiki/Locus-Delta-Events
 */
export default class Parser {
  // processing status
  static status = {
    IDLE: 'IDLE',
    PAUSED: 'PAUSED',
    WORKING: 'WORKING',
  };

  // loci comparison states
  static loci = {
    EQ: 'EQUAL',
    GT: 'GREATER_THAN',
    LT: 'LESS_THAN',
    DESYNC: 'DESYNC',
    USE_INCOMING: 'USE_INCOMING',
    USE_CURRENT: 'USE_CURRENT',
    ERROR: 'ERROR',
  };

  queue: any;
  workingCopy: any;

  /**
   * @constructs Parser
   */
  constructor() {
    this.queue = new SimpleQueue();
    // @ts-ignore - This is declared as static class member and again being initialized here from same
    this.status = Parser.status.IDLE;
    this.onDeltaAction = null;
    this.workingCopy = null;
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
    const {LT, GT, EQ, DESYNC, USE_INCOMING} = Parser.loci;

    const {extractComparisonState: extract} = Parser;
    const {packComparisonResult: pack} = Parser;

    const result = Parser.compareSequence(current.sequence, incoming.sequence);
    let comparison = extract(result);

    if (comparison !== LT) {
      return pack(Parser.compareToAction(comparison), result);
    }

    comparison = Parser.compareSequence(current.sequence, incoming.baseSequence);

    switch (extract(comparison)) {
      case GT:
      case EQ:
        comparison = USE_INCOMING;
        break;

      default:
        comparison = DESYNC;
    }

    return pack(comparison, result);
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
    const {IDLE} = Parser.status;
    const {isLoci} = Parser;
    // @ts-ignore
    const setStatus = (status) => {
      // @ts-ignore
      this.status = status;
    };

    // one or both objects are not locus delta events
    if (!isLoci(this.workingCopy) || !isLoci(newLoci)) {
      setStatus(IDLE);
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
    // @ts-ignore
    if (this.status === Parser.status.PAUSED) {
      LoggerProxy.logger.info('Locus-info:parser#nextEvent --> Locus parser paused.');

      return;
    }

    // continue processing until queue is empty
    if (this.queue.size() > 0) {
      this.processDeltaEvent();
    } else {
      // @ts-ignore
      this.status = Parser.status.IDLE;
    }
  }

  /**
   * Function handler for delta actions,
   * is set by instance callee.
   * @param {string} action Locus delta action
   * @param {Types~Locus} locus Locus delta
   * @returns {undefined}
   */
  // eslint-disable-next-line no-unused-vars
  onDeltaAction(action: string, locus) {}

  /**
   * Event handler for locus delta events
   * @param {Types~Locus} loci Locus Delta
   * @returns {undefined}
   */
  onDeltaEvent(loci) {
    // enqueue the new loci
    this.queue.enqueue(loci);
    // start processing events in the queue if idle
    // and a function handler is defined
    // @ts-ignore
    if (this.status === Parser.status.IDLE && this.onDeltaAction) {
      // Update status, ensure we only process one event at a time.
      // @ts-ignore
      this.status = Parser.status.WORKING;

      this.processDeltaEvent();
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
    // @ts-ignore
    this.status = Parser.status.PAUSED;
    LoggerProxy.logger.info('Locus-info:parser#pause --> Locus parser paused.');
  }

  /**
   * Processes next locus delta in the queue,
   * continues until the queue is empty
   * or cleared.
   * @returns {undefined}
   */
  processDeltaEvent() {
    const {DESYNC, USE_INCOMING} = Parser.loci;
    const {extractComparisonState: extract} = Parser;
    const newLoci = this.queue.dequeue();

    if (!this.isValidLocus(newLoci)) {
      return;
    }

    const result = Parser.compare(this.workingCopy, newLoci);
    const lociComparison = extract(result);

    // limited debugging, use chrome extension
    // for full debugging.
    LoggerProxy.logger.debug(`Locus-info:parser#processDeltaEvent --> Locus Debug: ${result}`);

    if (lociComparison === DESYNC) {
      // wait for desync response
      this.pause();
    } else if (lociComparison === USE_INCOMING) {
      // update working copy for future comparisons.
      // Note: The working copy of parser gets updated in .onFullLocus()
      // and here when USE_INCOMING locus.
      this.workingCopy = newLoci;
    }

    if (this.onDeltaAction) {
      LoggerProxy.logger.info(
        `Locus-info:parser#processDeltaEvent --> Locus Delta Action: ${lociComparison}`
      );

      // eslint-disable-next-line no-useless-call
      this.onDeltaAction.call(this, lociComparison, newLoci);
    }

    this.nextEvent();
  }

  /**
   * Resume from a paused state
   * @returns {undefined}
   */
  resume() {
    LoggerProxy.logger.info('Locus-info:parser#resume --> Locus parser resumed.');
    // @ts-ignore
    this.status = Parser.status.WORKING;
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
