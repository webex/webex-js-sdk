/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import LocusDeltaParser from '@webex/plugin-meetings/src/locus-info/parser';
import Metrics from '@webex/plugin-meetings/src/metrics';

import basicSequenceComparisons from './lib/BasicSeqCmp.json';
import sequenceComparisons from './lib/SeqCmp';

describe('locus-info/parser', () => {
  describe('Locus Sequence Comparison Algorithm', () => {
    describe('basic sequence comparisons', () => {
      Object.keys(basicSequenceComparisons.comparisons).forEach((key) => {
        const {extractComparisonState: extract} = LocusDeltaParser;
        const incomingKey = basicSequenceComparisons.comparisons[key].new;
        const currentKey = basicSequenceComparisons.comparisons[key].current;
        const {result} = basicSequenceComparisons.comparisons[key];

        const current = basicSequenceComparisons.sequences[currentKey];
        const incoming = basicSequenceComparisons.sequences[incomingKey];
        const comparison = extract(LocusDeltaParser.compareSequence(current, incoming));

        it(key, () => {
          assert.isDefined(current);
          assert.isDefined(incoming);
          assert.equal(comparison, result);
        });
      });
    });

    describe('sequence comparisons', () => {
      Object.keys(sequenceComparisons.comparisons).forEach((key) => {
        const {extractComparisonState: extract} = LocusDeltaParser;
        const incomingKey = sequenceComparisons.comparisons[key].new;
        const currentKey = sequenceComparisons.comparisons[key].current;
        const {description, result} = sequenceComparisons.comparisons[key];

        const current = sequenceComparisons.sequences[currentKey];
        const incoming = sequenceComparisons.sequences[incomingKey];
        const comparison = extract(LocusDeltaParser.compareSequence(current, incoming));

        it(`${key} - ${description}`, () => {
          assert.isDefined(current);
          assert.isDefined(incoming);
          assert.equal(comparison, result);
        });
      });
    });

    describe('delta sequence comparisons', () => {
      const {DESYNC, USE_CURRENT, USE_INCOMING, WAIT, LOCUS_URL_CHANGED} = LocusDeltaParser.loci;
      const {extractComparisonState: extract} = LocusDeltaParser;

      sinon.stub(Metrics, 'sendBehavioralMetric');
      
      function translate(action) {
        switch (action) {
          case 'ACCEPT_NEW':
            return USE_INCOMING;
          case 'KEEP_CURRENT':
            return USE_CURRENT;
          case 'DESYNC':
            return DESYNC;
          case 'WAIT':
            return WAIT;
          case 'LOCUS_URL_CHANGED':
            return LOCUS_URL_CHANGED;
          default:
            throw new Error(`${action} not recognized`);
        }
      }
      Object.keys(sequenceComparisons.update_actions).forEach((key) => {
        const incomingKey = sequenceComparisons.update_actions[key].new;
        const currentKey = sequenceComparisons.update_actions[key].current;
        const baseKey = sequenceComparisons.update_actions[key].newbase;
        const {description, result} = sequenceComparisons.update_actions[key];

        const current = {
          sequence: sequenceComparisons.sequences[currentKey],
          url: sequenceComparisons.update_actions[key].currentUrl,
        };
        const incoming = {
          sequence: sequenceComparisons.sequences[incomingKey],
          baseSequence: sequenceComparisons.sequences[baseKey],
          url: sequenceComparisons.update_actions[key].incomingUrl,
        };
        const comparison = LocusDeltaParser.compare(current, incoming);
        const action = extract(comparison);

        it(`${key} - ${description}`, () => {
          assert.isDefined(current.sequence);
          assert.isDefined(incoming.sequence);
          assert.equal(action, translate(result));
        });
      });

      Metrics.sendBehavioralMetric.restore();
    });
  });

  describe('Queues events', () => {
    it('has the ability to queue events', () => {
      const parser = new LocusDeltaParser();
      const output = [];
      const maxEvents = 30;

      const fakeEvents = (() => {
        const burst = [];

        for (let i = 1; i <= maxEvents; i += 1) {
          burst.push(i);
        }

        return burst;
      })();

      parser.onDeltaAction = sinon.stub();
      parser.processDeltaEvent = function () {
        const fakeLoci = this.queue.dequeue();

        // nothing to do, queue is empty
        if (!fakeLoci) return;

        output.push(fakeLoci);
        this.nextEvent();
      };

      const generate = new Promise((resolve) => {
        setTimeout(() => {
          for (const event of fakeEvents) {
            parser.onDeltaEvent(event);
          }
          resolve();
        }, 0);
      });

      return generate.then(() => {
        assert.equal(output.join(), fakeEvents.join());
      });
    });
  });

  describe('Processes delta events correctly', () => {
    const CURRENT_LOCI = {sequence: {entries: [100]}, url: 'CURRENT LOCI', baseSequence: {
      "entries": [100], "rangeStart": 100, "rangeEnd": 100}};
    const NEW_LOCI = {sequence: {entries: [200]}, url: 'NEW LOCI', baseSequence: {
      "entries": [200], "rangeStart": 200, "rangeEnd": 200}};

    let sandbox = null;
    let parser;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      parser = new LocusDeltaParser();
      sandbox.stub(parser, 'isValidLocus').returns(true);
      parser.queue.dequeue = sandbox.stub().returns(NEW_LOCI);
      parser.onDeltaAction = sandbox.stub();
    });

    afterEach(() => {
      sandbox.restore();
      sandbox = null;
    });

    it('should pause processing on DESYNC', () => {
      const {DESYNC} = LocusDeltaParser.loci;

      parser.pause = sandbox.stub();
      sandbox.stub(LocusDeltaParser, 'compare').returns(DESYNC);

      parser.processDeltaEvent();

      assert.calledOnce(parser.pause);
    });

    it('should update working copy on USE_INCOMING', () => {
      const {USE_INCOMING} = LocusDeltaParser.loci;

      parser.workingCopy = null;
      sandbox.stub(LocusDeltaParser, 'compare').returns(USE_INCOMING);

      parser.processDeltaEvent();

      assert.equal(parser.workingCopy, NEW_LOCI);
    });

    it('calls onDeltaAction() when a comparison result is available', () => {
      const {USE_INCOMING} = LocusDeltaParser.loci;
      const lociComparison = USE_INCOMING;

      sandbox.stub(LocusDeltaParser, 'compare').returns(lociComparison);

      parser.processDeltaEvent();

      assert.calledWith(parser.onDeltaAction, lociComparison, NEW_LOCI);
    });

    it('should call nextEvent()', () => {
      const {USE_INCOMING} = LocusDeltaParser.loci;

      sandbox.stub(LocusDeltaParser, 'compare').returns(USE_INCOMING);
      parser.nextEvent = sandbox.stub();

      parser.processDeltaEvent();

      assert.calledOnce(parser.nextEvent);
    });

    it('should not call compare() if locus is invalid', () => {
      const {USE_INCOMING} = LocusDeltaParser.loci;

      sandbox.stub(LocusDeltaParser, 'compare').returns(USE_INCOMING);

      // restore the original method
      parser.isValidLocus.restore();
      parser.isValidLocus.bind(parser);

      parser.processDeltaEvent.bind(parser);

      assert.notCalled(LocusDeltaParser.compare);
    });

    it('processDeltaEvent() should take next item in queue', () => {
      parser.workingCopy = CURRENT_LOCI;
      
      parser.processDeltaEvent();

      assert.calledOnce(parser.queue.dequeue);
    });

    it('should be able to pack comparison results', () => {
      const {packComparisonResult: pack} = LocusDeltaParser;
      const pastResults = 'value03:value:02:value01';
      const newResult = 'value04';

      const comparisonResults = pack(newResult, pastResults);

      const expectedResults = 'value04:value03:value:02:value01';

      assert.equal(comparisonResults, expectedResults);
    });

    it('should be able to unpack comparison results', () => {
      const {extractComparisonState: extract} = LocusDeltaParser;

      const comparisonResults = 'value04:value03:value:02:value01';
      const lastResult = extract(comparisonResults);

      assert.equal(lastResult, 'value04');
    });
    
    it('replaces current loci when the locus URL changes and incoming sequence is later, even when baseSequence doesn\'t match', () => {
      const {USE_INCOMING} = LocusDeltaParser.loci;

      parser.queue.dequeue = sandbox.stub().returns(NEW_LOCI);
      parser.onDeltaAction = sandbox.stub();
      parser.workingCopy = CURRENT_LOCI;
      parser.triggerSync = sandbox.stub();

      parser.processDeltaEvent();

      assert.equal(parser.workingCopy, NEW_LOCI);
    });

    it('does not replace current loci when the locus URL changes but incoming sequence is not later', () => {
      const {USE_INCOMING} = LocusDeltaParser.loci;
      const laterLoci = {...CURRENT_LOCI, sequence: {entries: [300]}};

      parser.queue.dequeue = sandbox.stub().returns(NEW_LOCI);
      parser.onDeltaAction = sandbox.stub();
      parser.workingCopy = laterLoci;

      parser.processDeltaEvent();

      assert.equal(parser.workingCopy, laterLoci);
    });
  });

  describe('Full Locus handling', () => {
    describe('isNewFullLocus', () => {
      let parser;

      beforeEach(() => {
        parser = new LocusDeltaParser();
      })
      it('returns false if incoming Locus is not valid', () => {
        const fakeInvalidIncomingLocus = {};

        parser.workingCopy = { sequence: {rangeStart: 0, rangeEnd: 0, entries: [1]}};

        assert.isFalse(parser.isNewFullLocus(fakeInvalidIncomingLocus));
      });

      const runCheck = (incomingSequence, currentSequence, expectedResult) => {
        parser.workingCopy = { sequence: {rangeStart: 0, rangeEnd: 0, entries: [1, 2, currentSequence]}};

        const fakeIncomingLocus = { sequence: {rangeStart: 0, rangeEnd: 0, entries: [1, 10, incomingSequence]}};

        assert.strictEqual(parser.isNewFullLocus(fakeIncomingLocus), expectedResult);
      }
      it('returns true if there is no working copy', () => {
        const fakeIncomingLocus = { sequence: {rangeStart: 0, rangeEnd: 0, entries: [10]}};

        // sanity check that we initially have no working copy 
        assert.isNull(parser.workingCopy);

        assert.isTrue(parser.isNewFullLocus(fakeIncomingLocus));
      });

      it('returns true if new sequence is higher than existing one', () => {
        runCheck(101, 100, true);
      });

      it('returns false if new sequence is same than existing one', () => {
        runCheck(100, 100, false);
      });

      it('returns false if new sequence is older than existing one', () => {
        runCheck(99, 100, false);
      });

      it('returns true if incoming Locus has empty sequence', () => {
        parser.workingCopy = { sequence: {rangeStart: 0, rangeEnd: 0, entries: [1, 2, 3]}};

        const fakeIncomingLocus = { sequence: {rangeStart: 0, rangeEnd: 0, entries: []}};

        assert.isTrue(parser.isNewFullLocus(fakeIncomingLocus));
      });

      it('returns true if working copy has empty sequence', () => {
        parser.workingCopy = { sequence: {rangeStart: 0, rangeEnd: 0, entries: []}};

        const fakeIncomingLocus = { sequence: {rangeStart: 0, rangeEnd: 0, entries: [1,2,3]}};

        assert.isTrue(parser.isNewFullLocus(fakeIncomingLocus));
      });

    })
  });

  describe('Invalid Locus objects', () => {
    let sandbox = null;
    let parser;
    let loci;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      parser = new LocusDeltaParser();
      loci = {
        rangeStart: 0,
        rangeEnd: 0,
      };
    });

    afterEach(() => {
      sandbox.restore();
      sandbox = null;
    });

    it('returns false if workingCopy is invalid', () => {
      parser.workingCopy = null;

      const result = parser.isValidLocus(loci);

      assert.isFalse(result);
    });

    it('returns false if loci is invalid', () => {
      parser.workingCopy = loci;

      const result = parser.isValidLocus(null);

      assert.isFalse(result);
    });
  });
});
