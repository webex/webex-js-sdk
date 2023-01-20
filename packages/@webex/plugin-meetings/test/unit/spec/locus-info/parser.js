/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import LocusDeltaParser from '@webex/plugin-meetings/src/locus-info/parser';

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
      const {DESYNC, USE_CURRENT, USE_INCOMING} = LocusDeltaParser.loci;
      const {extractComparisonState: extract} = LocusDeltaParser;

      function translate(action) {
        switch (action) {
          case 'ACCEPT_NEW':
            return USE_INCOMING;
          case 'KEEP_CURRENT':
            return USE_CURRENT;
          case 'DESYNC':
            return DESYNC;
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
        };
        const incoming = {
          sequence: sequenceComparisons.sequences[incomingKey],
          baseSequence: sequenceComparisons.sequences[baseKey],
        };
        const comparison = LocusDeltaParser.compare(current, incoming);
        const action = extract(comparison);

        it(`${key} - ${description}`, () => {
          assert.isDefined(current.sequence);
          assert.isDefined(incoming.sequence);
          assert.equal(action, translate(result));
        });
      });
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

      parser.onDeltaAction = true;
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
    const NEW_LOCI = 'NEW LOCI';
    let sandbox = null;
    let parser;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      parser = new LocusDeltaParser();
      sandbox.stub(parser, 'isValidLocus').returns(true);
      parser.queue.dequeue = sandbox.stub().returns(NEW_LOCI);
    });

    afterEach(() => {
      sandbox.restore();
      sandbox = null;
    });

    it('should pause processing on DESYNC', () => {
      const {DESYNC} = LocusDeltaParser.loci;

      parser.pause = sandbox.stub();
      LocusDeltaParser.compare = sandbox.stub().returns(DESYNC);

      parser.processDeltaEvent();

      assert.calledOnce(parser.pause);
    });

    it('should update working copy on USE_INCOMING', () => {
      const {USE_INCOMING} = LocusDeltaParser.loci;

      parser.workingCopy = null;
      LocusDeltaParser.compare = sandbox.stub().returns(USE_INCOMING);

      parser.processDeltaEvent();

      assert.equal(parser.workingCopy, NEW_LOCI);
    });

    it('calls onDeltaAction() when a comparison result is available', () => {
      const {USE_INCOMING} = LocusDeltaParser.loci;
      const lociComparison = USE_INCOMING;

      LocusDeltaParser.compare = sandbox.stub().returns(lociComparison);
      parser.onDeltaAction = sandbox.stub();

      parser.processDeltaEvent();

      assert.calledWith(parser.onDeltaAction, lociComparison, NEW_LOCI);
    });

    it('should call nextEvent()', () => {
      const {USE_INCOMING} = LocusDeltaParser.loci;

      LocusDeltaParser.compare = sandbox.stub().returns(USE_INCOMING);
      parser.nextEvent = sandbox.stub();

      parser.processDeltaEvent();

      assert.calledOnce(parser.nextEvent);
    });

    it('should not call compare() if locus is invalid', () => {
      const {USE_INCOMING} = LocusDeltaParser.loci;

      LocusDeltaParser.compare = sandbox.stub().returns(USE_INCOMING);
      // restore the original method
      parser.isValidLocus.restore();
      parser.isValidLocus.bind(parser);

      parser.processDeltaEvent.bind(parser);

      assert.notCalled(LocusDeltaParser.compare);
    });

    it('processDeltaEvent() should take next item in queue', () => {
      // restore the original method
      parser.queue.dequeue = sandbox.stub();

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

    it('shoud be able to unpack comparison results', () => {
      const {extractComparisonState: extract} = LocusDeltaParser;

      const comparisonResults = 'value04:value03:value:02:value01';
      const lastResult = extract(comparisonResults);

      assert.equal(lastResult, 'value04');
    });
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

    it('sets parser status to IDLE if workingCopy is invalid', () => {
      const {IDLE, WORKING} = LocusDeltaParser.status;

      parser.workingCopy = null;
      parser.status = WORKING;

      parser.isValidLocus(loci);

      assert.equal(parser.status, IDLE);
    });

    it('sets parser status to IDLE if new loci is invalid', () => {
      const {IDLE, WORKING} = LocusDeltaParser.status;

      parser.workingCopy = loci;
      parser.status = WORKING;

      parser.isValidLocus(null);

      assert.equal(parser.status, IDLE);
    });
  });
});
