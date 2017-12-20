/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import lolex from 'lolex';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import {StatsStream} from '@ciscospark/plugin-phone';

describe('StatsStream', () => {
  let clock;
  beforeEach(() => {
    clock = lolex.install();
  });

  afterEach(() => clock.uninstall());

  it('emits stats from a peer connection one per second', () => {
    const pc = {
      getStats: sinon.stub().returns(Promise.resolve({
        some: 'stat'
      }))
    };

    const ss = new StatsStream(pc);
    // Ideally, this would be `ss.on('data', noop)`, but with lolex installed,
    // that doesn't seem kick off the proper ReadableStream behavior. I'm
    // *pretty sure* that calling read explicitly is close enough to an adequate
    // real-world example.
    ss.read();

    clock.tick(999);
    assert.notCalled(pc.getStats);
    clock.tick(1);
    assert.calledOnce(pc.getStats);
  });


  describe('when multiple StatsStreams are attached to the same peer connection', () => {
    it("does not poll that peer connection's getStats more than once per second", () => {
      const pc = {
        getStats: sinon.stub().returns(Promise.resolve({
          some: 'stat'
        }))
      };

      const s1 = new StatsStream(pc);
      s1.read();
      const s2 = new StatsStream(pc);
      s2.read();
      const s3 = new StatsStream(pc);
      s3.read();
      const s4 = new StatsStream(pc);
      s4.read();

      clock.tick(999);
      assert.notCalled(pc.getStats);
      clock.tick(1);
      assert.calledOnce(pc.getStats);
    });
  });
});
