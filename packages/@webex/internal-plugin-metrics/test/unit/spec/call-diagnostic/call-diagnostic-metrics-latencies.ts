import {assert} from '@webex/test-helper-chai';
import CallDiagnosticLatencies from '../../../../src/call-diagnostic/call-diagnostic-metrics-latencies';
import sinon from 'sinon';

describe('internal-plugin-metrics', () => {
  describe('CallDiagnosticLatencies', () => {
    let cdl: CallDiagnosticLatencies;
    var now = new Date();

    beforeEach(() => {
      sinon.createSandbox();
      sinon.useFakeTimers(now.getTime());
      const webex = {
        meetings: {
          getBasicMeetingInformation: (id: string) => {
            if (id === 'meeting-id') {
              return {id: 'meeting-id', allowMediaInLobby: true};
            }
          },
        },
      };

      cdl = new CallDiagnosticLatencies(
        {},
        {
          parent: webex,
        }
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should save timestamp correctly', () => {
      assert.deepEqual(cdl.latencyTimestamps.size, 0);
      cdl.saveTimestamp({key: 'client.alert.displayed'});
      assert.deepEqual(cdl.latencyTimestamps.size, 1);
      assert.deepEqual(cdl.latencyTimestamps.get('client.alert.displayed'), now.getTime());
    });

    it('should save latency correctly by default and overwrites', () => {
      assert.deepEqual(cdl.precomputedLatencies.size, 0);
      cdl.saveLatency('internal.client.pageJMT', 10);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 10);
      cdl.saveLatency('internal.client.pageJMT', 20);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 20);
    });

    it('should overwrite latency when accumulate is false', () => {
      assert.deepEqual(cdl.precomputedLatencies.size, 0);
      cdl.saveLatency('internal.client.pageJMT', 10, {accumulate: false});
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 10);
      cdl.saveLatency('internal.client.pageJMT', 20, {accumulate: false});
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 20);
    });

    it('should save latency correctly when accumulate is true', () => {
      assert.deepEqual(cdl.precomputedLatencies.size, 0);
      cdl.saveLatency('internal.client.pageJMT', 10, {accumulate: true});
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 10);
    });

    it('should save latency correctly when accumulate is true and there is existing value', () => {
      assert.deepEqual(cdl.precomputedLatencies.size, 0);
      cdl.saveLatency('internal.client.pageJMT', 10);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 10);
      cdl.saveLatency('internal.client.pageJMT', 10, {accumulate: true});
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 20);
    });

    it('should save only first timestamp correctly', () => {
      assert.deepEqual(cdl.latencyTimestamps.size, 0);
      cdl.saveFirstTimestampOnly('client.alert.displayed', 10);
      cdl.saveFirstTimestampOnly('client.alert.displayed', 20);
      assert.deepEqual(cdl.latencyTimestamps.get('client.alert.displayed'), 10);
    });

    it('should save only first timestamp correctly for client.media.tx.start and client.media.rx.start', () => {
      assert.deepEqual(cdl.latencyTimestamps.size, 0);
      cdl.saveFirstTimestampOnly('client.media.tx.start', 10);
      cdl.saveFirstTimestampOnly('client.media.tx.start', 20);
      cdl.saveFirstTimestampOnly('client.media.rx.start', 12);
      cdl.saveFirstTimestampOnly('client.media.rx.start', 22);
      assert.deepEqual(cdl.latencyTimestamps.get('client.media.tx.start'), 10);
      assert.deepEqual(cdl.latencyTimestamps.get('client.media.rx.start'), 12);
    });

    it('should update existing property and now add new keys', () => {
      assert.deepEqual(cdl.latencyTimestamps.size, 0);
      cdl.saveTimestamp({key: 'client.alert.displayed'});
      assert.deepEqual(cdl.latencyTimestamps.get('client.alert.displayed'), now.getTime());
      cdl.saveTimestamp({key: 'client.alert.displayed', value: 1234});
      assert.deepEqual(cdl.latencyTimestamps.get('client.alert.displayed'), 1234);
      assert.deepEqual(cdl.latencyTimestamps.size, 1);
    });

    it('should clear all timestamps correctly', () => {
      cdl.saveTimestamp({key: 'client.alert.displayed'});
      cdl.saveTimestamp({key: 'client.alert.removed'});
      assert.deepEqual(cdl.latencyTimestamps.size, 2);
      cdl.saveLatency('internal.api.fetch.intelligence.models', 42);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      cdl.saveTimestamp({
        key: 'internal.client.locus.sync.start',
        value: 1,
        options: {
          meetingId: 'meeting-1',
          dataSetName: 'main',
          randomBackoffTime: 10,
          trackingId: 'sync-tracking-id',
        },
      });
      assert.deepEqual(cdl.meetingLatencies.size, 1);

      cdl.clearTimestamps();

      assert.deepEqual(cdl.latencyTimestamps.size, 0);
      assert.deepEqual(cdl.precomputedLatencies.size, 0);
      assert.deepEqual(cdl.meetingLatencies.size, 0);
    });

    describe('locus sync latencies', () => {
      it('uses pending sync backoff latency when sync starts', () => {
        cdl.saveLatency('internal.client.locus.sync.random.backoff', 10.4, {
          meetingId: 'meeting-1',
          dataSetName: 'main',
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 110,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 130,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.message.received',
          value: 140,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });

        assert.deepEqual(cdl.getLocusSyncLatency('meeting-1', 'sync-tracking-id'), {
          randomBackoffTime: 10,
          hashtreePrepTime: 0,
          hashtreeResponseTime: 0,
          syncPrepTime: 10,
          syncResponseTime: 20,
          syncMessageReceiveTime: 30,
          totalTime: 40,
        });
      });

      it('calculates sync latency values from milestones', () => {
        cdl.saveLatency('internal.client.locus.sync.random.backoff', 10.4, {
          meetingId: 'meeting-1',
          dataSetName: 'main',
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'sync-tracking-id',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.hashtree.request',
          value: 105,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.hashtree.response',
          value: 125,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 128,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 143,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.message.received',
          value: 150,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });

        assert.deepEqual(cdl.getLocusSyncLatency('meeting-1', 'sync-tracking-id'), {
          randomBackoffTime: 10,
          hashtreePrepTime: 5,
          hashtreeResponseTime: 20,
          syncPrepTime: 3,
          syncResponseTime: 15,
          syncMessageReceiveTime: 22,
          totalTime: 50,
        });
      });

      it('calculates sync latency values when hash tree request is skipped', () => {
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            randomBackoffTime: 0,
            trackingId: 'sync-tracking-1',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 110,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'sync-tracking-1',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 130,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-1'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.message.received',
          value: 140,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-1'},
        });

        assert.deepEqual(cdl.getLocusSyncLatency('meeting-1', 'sync-tracking-1'), {
          randomBackoffTime: 0,
          hashtreePrepTime: 0,
          hashtreeResponseTime: 0,
          syncPrepTime: 10,
          syncResponseTime: 20,
          syncMessageReceiveTime: 30,
          totalTime: 40,
        });
      });

      it('associates sync response tracking id and completes the matching meeting record', () => {
        const clock = sinon.useFakeTimers({now: 150});

        try {
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.start',
            value: 100,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              randomBackoffTime: 0,
              trackingId: 'our-sync-tracking-id',
            },
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.request',
            value: 110,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'our-sync-tracking-id',
            },
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.response',
            value: 130,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'our-sync-tracking-id',
            },
          });
          // the LLM state-update message that gates the metric arrives for this sync
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.message.received',
            value: 150,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'our-sync-tracking-id',
            },
          });
          cdl.saveLatency('internal.client.locus.sync.random.backoff', 99, {
            meetingId: 'meeting-1',
            dataSetName: 'main',
          });

          // eager completion: both the /sync response and the LLM message are present
          assert.deepEqual(cdl.completeLocusSyncLatency('meeting-1', 'our-sync-tracking-id'), {
            dataSet: 'main',
            syncLatency: {
              randomBackoffTime: 0,
              hashtreePrepTime: 0,
              hashtreeResponseTime: 0,
              syncPrepTime: 10,
              syncResponseTime: 20,
              syncMessageReceiveTime: 40,
              totalTime: 50,
            },
          });
          // completing the metric removes the matching record, leaving only the pending
          // backoff record created above for the next sync to consume
          assert.lengthOf(cdl.meetingLatencies.get('meeting-1'), 1);

          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.start',
            value: 200,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'next-sync-tracking-id',
            },
          });
          assert.deepInclude(cdl.meetingLatencies.get('meeting-1'), {
            locusSync: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              randomBackoffTime: 99,
              trackingId: 'next-sync-tracking-id',
              syncStart: 200,
            },
          });
        } finally {
          clock.restore();
        }
      });

      it('does not bind message.received when tracking id does not match any record', () => {
        const clock = sinon.useFakeTimers({now: 500});

        try {
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.start',
            value: 100,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              randomBackoffTime: 0,
              trackingId: 'sync-tracking-id',
            },
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.request',
            value: 110,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'sync-tracking-id',
            },
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.response',
            value: 130,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'sync-tracking-id',
            },
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.message.received',
            value: 140,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'llm-envelope-id',
            },
          });

          assert.isUndefined(cdl.completeLocusSyncLatency('meeting-1', 'llm-envelope-id'));
          assert.isUndefined(cdl.meetingLatencies.get('meeting-1')?.[0].locusSync.messageReceived);
        } finally {
          clock.restore();
        }
      });

      it('does not allow totalTime to drop below sync response duration when message.received is stale', () => {
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            randomBackoffTime: 0,
            trackingId: 'sync-tracking-id',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 101,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'sync-tracking-id',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 475,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'sync-tracking-id',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.message.received',
          value: 90,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'sync-tracking-id',
          },
        });

        assert.deepEqual(cdl.completeLocusSyncLatency('meeting-1', 'sync-tracking-id'), {
          dataSet: 'main',
          syncLatency: {
            randomBackoffTime: 0,
            hashtreePrepTime: 0,
            hashtreeResponseTime: 0,
            syncPrepTime: 1,
            syncResponseTime: 374,
            syncMessageReceiveTime: 0,
            totalTime: 375,
          },
        });
      });

      it('drops and consumes a completed sync latency record when a segment exceeds the clock skew threshold', () => {
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'sync-tracking-id',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 110,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 600111,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.message.received',
          value: 600112,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });

        assert.isUndefined(cdl.completeLocusSyncLatency('meeting-1', 'sync-tracking-id'));
        assert.isFalse(cdl.meetingLatencies.has('meeting-1'));
      });

      it('allows a completed sync latency record when the largest segment equals the clock skew threshold', () => {
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'sync-tracking-id',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 110,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 600100,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.message.received',
          value: 600100,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });

        assert.deepEqual(cdl.completeLocusSyncLatency('meeting-1', 'sync-tracking-id'), {
          dataSet: 'main',
          syncLatency: {
            randomBackoffTime: 0,
            hashtreePrepTime: 0,
            hashtreeResponseTime: 0,
            syncPrepTime: 10,
            syncResponseTime: 599990,
            syncMessageReceiveTime: 599990,
            totalTime: 600000,
          },
        });
        assert.isFalse(cdl.meetingLatencies.has('meeting-1'));
      });

      it('matches exact record by tracking id on first pass', () => {
        const clock = sinon.useFakeTimers({now: 300});

        try {
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.start',
            value: 100,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              randomBackoffTime: 0,
              trackingId: 'sync-tracking-1',
            },
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.request',
            value: 110,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'sync-tracking-1',
            },
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.response',
            value: 130,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'sync-tracking-1',
            },
          });

          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.start',
            value: 200,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              randomBackoffTime: 0,
              trackingId: 'sync-tracking-2',
            },
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.request',
            value: 210,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'sync-tracking-2',
            },
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.response',
            value: 230,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'sync-tracking-2',
            },
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.message.received',
            value: 240,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'sync-tracking-2',
            },
          });

          assert.deepEqual(cdl.completeLocusSyncLatency('meeting-1', 'sync-tracking-2'), {
            dataSet: 'main',
            syncLatency: {
              randomBackoffTime: 0,
              hashtreePrepTime: 0,
              hashtreeResponseTime: 0,
              syncPrepTime: 10,
              syncResponseTime: 20,
              syncMessageReceiveTime: 30,
              totalTime: 40,
            },
          });
        } finally {
          clock.restore();
        }
      });

      it('does not bind message.received when tracking id does not match any record', () => {
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            randomBackoffTime: 0,
            trackingId: 'sync-tracking-1',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 110,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-1'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 130,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-1'},
        });

        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 200,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            randomBackoffTime: 0,
            trackingId: 'sync-tracking-2',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 210,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'sync-tracking-2',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 230,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-2'},
        });

        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.message.received',
          value: 120,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'llm-unknown-id',
          },
        });

        const records = cdl.meetingLatencies.get('meeting-1');

        assert.isDefined(records);
        assert.lengthOf(records!, 2);
        assert.isUndefined(records![0].locusSync.messageReceived);
        assert.isUndefined(records![1].locusSync.messageReceived);
      });

      it('binds message.received when the tracking id matches the only record', () => {
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            randomBackoffTime: 0,
            trackingId: 'sync-tracking-id',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 110,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'sync-tracking-id',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 130,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });

        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.message.received',
          value: 140,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'sync-tracking-id',
          },
        });

        const records = cdl.meetingLatencies.get('meeting-1');

        assert.isDefined(records);
        assert.lengthOf(records!, 1);
        assert.equal(records![0].locusSync.messageReceived, 140);
      });

      it('returns undefined when the tracking id does not match', () => {
        const clock = sinon.useFakeTimers({now: 150});

        try {
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.start',
            value: 100,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              randomBackoffTime: 0,
              trackingId: 'our-sync-tracking-id',
            },
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.request',
            value: 110,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'our-sync-tracking-id',
            },
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.response',
            value: 130,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: 'our-sync-tracking-id',
            },
          });

          assert.isUndefined(cdl.completeLocusSyncLatency('meeting-1', 'llm-envelope-tracking-id'));
        } finally {
          clock.restore();
        }
      });

      it('does not clean up older never-completed record for the same dataset when newer sync completes', () => {
        // first sync: all sync milestones recorded, but its completing LLM event never arrives
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            randomBackoffTime: 0,
            trackingId: 'sync-tracking-1',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 110,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-1'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 130,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-1'},
        });

        // a second sync for the same dataset starts before the first one completed.
        // because the first record already has syncStart set, it is not reused and a
        // brand new record is created for the second sync
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 200,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            randomBackoffTime: 0,
            trackingId: 'sync-tracking-2',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 210,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-2'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 230,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-2'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.message.received',
          value: 240,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-2'},
        });

        // both records exist before completion
        assert.lengthOf(cdl.meetingLatencies.get('meeting-1')!, 2);

        // completing the second sync removes only its own record; the older pending record is left
        // in place because a late LLM message could still complete it (stale cleanup is handled by
        // the TTL / capacity pruning, not by completion).
        const completed = cdl.completeLocusSyncLatency('meeting-1', 'sync-tracking-2');

        assert.isDefined(completed);
        assert.equal(completed!.dataSet, 'main');

        const remaining = cdl.meetingLatencies.get('meeting-1');

        assert.isDefined(remaining);
        assert.lengthOf(remaining!, 1);
        assert.equal(remaining![0].locusSync.trackingId, 'sync-tracking-1');
      });

      it('prunes an incomplete record once it is older than the pending TTL', () => {
        // an incomplete sync record that never received its LLM message
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'stale-tracking-id',
          },
        });

        // a brand new sync for the same dataset starts more than the TTL later
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100 + 5 * 60 * 1000 + 1,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'fresh-tracking-id',
          },
        });

        const records = cdl.meetingLatencies.get('meeting-1');

        assert.isDefined(records);
        assert.lengthOf(records!, 1);
        assert.equal(records![0].locusSync.trackingId, 'fresh-tracking-id');
      });

      it('keeps an incomplete record that is still within the pending TTL', () => {
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'pending-tracking-id',
          },
        });

        // a new sync for the same dataset starts well within the TTL window
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100 + 1000,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'fresh-tracking-id',
          },
        });

        const records = cdl.meetingLatencies.get('meeting-1');

        assert.isDefined(records);
        assert.lengthOf(records!, 2);
        assert.equal(records![0].locusSync.trackingId, 'pending-tracking-id');
        assert.equal(records![1].locusSync.trackingId, 'fresh-tracking-id');
      });

      it('does not prune incomplete records from a different dataset', () => {
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'other',
            trackingId: 'other-tracking-id',
          },
        });

        // a much later sync for a different dataset must not touch the "other" record
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100 + 5 * 60 * 1000 + 1,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            trackingId: 'main-tracking-id',
          },
        });

        const records = cdl.meetingLatencies.get('meeting-1');

        assert.isDefined(records);
        assert.lengthOf(records!, 2);
        assert.equal(records![0].locusSync.trackingId, 'other-tracking-id');
        assert.equal(records![1].locusSync.trackingId, 'main-tracking-id');
      });

      it('caps the number of incomplete records kept per dataset', () => {
        // create more incomplete records than the per-dataset cap, all within the TTL window
        for (let i = 0; i <= 20; i += 1) {
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.start',
            value: 100 + i,
            options: {
              meetingId: 'meeting-1',
              dataSetName: 'main',
              trackingId: `sync-tracking-${i}`,
            },
          });
        }

        const records = cdl.meetingLatencies.get('meeting-1');
        const trackingIds = records!.map(({locusSync}) => locusSync.trackingId);

        assert.isDefined(records);
        assert.lengthOf(records!, 20);
        // the oldest record is dropped, the newest is kept
        assert.notInclude(trackingIds, 'sync-tracking-0');
        assert.include(trackingIds, 'sync-tracking-20');
      });

      it('does not clean up never-completed records for a different dataset', () => {
        // never-completed sync for dataset "other"
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'other',
            randomBackoffTime: 0,
            trackingId: 'other-tracking-1',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 110,
          options: {meetingId: 'meeting-1', dataSetName: 'other', trackingId: 'other-tracking-1'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 130,
          options: {meetingId: 'meeting-1', dataSetName: 'other', trackingId: 'other-tracking-1'},
        });

        // completed sync for dataset "main"
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 200,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            randomBackoffTime: 0,
            trackingId: 'main-tracking-1',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 210,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'main-tracking-1'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 230,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'main-tracking-1'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.message.received',
          value: 240,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'main-tracking-1'},
        });

        const completed = cdl.completeLocusSyncLatency('meeting-1', 'main-tracking-1');

        assert.isDefined(completed);

        // the "other" dataset record must remain untouched
        const records = cdl.meetingLatencies.get('meeting-1');

        assert.isDefined(records);
        assert.lengthOf(records!, 1);
        assert.equal(records![0].locusSync.dataSetName, 'other');
        assert.equal(records![0].locusSync.trackingId, 'other-tracking-1');
      });

      it('keys sync latency records by meeting id', () => {
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            randomBackoffTime: 10,
            trackingId: 'sync-tracking-1',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 110,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-1'},
        });

        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 200,
          options: {
            meetingId: 'meeting-2',
            dataSetName: 'main',
            randomBackoffTime: 23,
            trackingId: 'sync-tracking-2',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.request',
          value: 217,
          options: {meetingId: 'meeting-2', dataSetName: 'main', trackingId: 'sync-tracking-2'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 241,
          options: {meetingId: 'meeting-2', dataSetName: 'main', trackingId: 'sync-tracking-2'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.message.received',
          value: 268,
          options: {meetingId: 'meeting-2', dataSetName: 'main', trackingId: 'sync-tracking-2'},
        });

        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.response',
          value: 125,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-1'},
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.message.received',
          value: 150,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-1'},
        });

        assert.deepEqual(cdl.getLocusSyncLatency('meeting-1', 'sync-tracking-1'), {
          randomBackoffTime: 0,
          hashtreePrepTime: 0,
          hashtreeResponseTime: 0,
          syncPrepTime: 10,
          syncResponseTime: 15,
          syncMessageReceiveTime: 40,
          totalTime: 50,
        });
        assert.deepEqual(cdl.getLocusSyncLatency('meeting-2', 'sync-tracking-2'), {
          randomBackoffTime: 0,
          hashtreePrepTime: 0,
          hashtreeResponseTime: 0,
          syncPrepTime: 17,
          syncResponseTime: 24,
          syncMessageReceiveTime: 51,
          totalTime: 68,
        });

        cdl.clearLocusSyncLatency('main', 'meeting-1');

        assert.isUndefined(cdl.getLocusSyncLatency('meeting-1', 'sync-tracking-1'));
        assert.isDefined(cdl.getLocusSyncLatency('meeting-2', 'sync-tracking-2'));
      });

      it('returns undefined and clears state when required milestones are missing', () => {
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.start',
          value: 100,
          options: {
            meetingId: 'meeting-1',
            dataSetName: 'main',
            randomBackoffTime: 0,
            trackingId: 'sync-tracking-id',
          },
        });
        cdl.saveTimestamp({
          key: 'internal.client.locus.sync.message.received',
          value: 140,
          options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
        });

        assert.isUndefined(cdl.getLocusSyncLatency('meeting-1', 'sync-tracking-id'));
        cdl.clearLocusSyncLatency('main', 'meeting-1');
        assert.isFalse(cdl.meetingLatencies.has('meeting-1'));
      });

      it('clears only the record matching the tracking id when one is supplied', () => {
        const stampFullRecord = (trackingId: string, base: number) => {
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.start',
            value: base,
            options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId},
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.request',
            value: base + 10,
            options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId},
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.response',
            value: base + 25,
            options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId},
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.message.received',
            value: base + 50,
            options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId},
          });
        };

        // Two records for the same dataset/meeting but different tracking ids.
        stampFullRecord('sync-tracking-1', 100);
        stampFullRecord('sync-tracking-2', 200);

        assert.isDefined(cdl.getLocusSyncLatency('meeting-1', 'sync-tracking-1'));
        assert.isDefined(cdl.getLocusSyncLatency('meeting-1', 'sync-tracking-2'));

        // Clearing with a tracking id drops only that record, leaving the other intact.
        cdl.clearLocusSyncLatency('main', 'meeting-1', 'sync-tracking-1');

        assert.isUndefined(cdl.getLocusSyncLatency('meeting-1', 'sync-tracking-1'));
        assert.isDefined(cdl.getLocusSyncLatency('meeting-1', 'sync-tracking-2'));
      });

      describe('recordLocusSyncMessageReceived', () => {
        const startPendingSync = (trackingId: string) => {
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.start',
            value: 100,
            options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId},
          });
        };

        it('stamps messageReceived on the matching pending record using the current time', () => {
          const clock = sinon.useFakeTimers({now: 500});

          try {
            startPendingSync('sync-tracking-id');
            cdl.recordLocusSyncMessageReceived('meeting-1', 'sync-tracking-id');

            assert.equal(cdl.meetingLatencies.get('meeting-1')![0].locusSync.messageReceived, 500);
          } finally {
            clock.restore();
          }
        });

        it('does not overwrite an already recorded messageReceived', () => {
          const clock = sinon.useFakeTimers({now: 999});

          try {
            startPendingSync('sync-tracking-id');
            cdl.saveTimestamp({
              key: 'internal.client.locus.sync.message.received',
              value: 140,
              options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId: 'sync-tracking-id'},
            });
            cdl.recordLocusSyncMessageReceived('meeting-1', 'sync-tracking-id');

            assert.equal(cdl.meetingLatencies.get('meeting-1')![0].locusSync.messageReceived, 140);
          } finally {
            clock.restore();
          }
        });

        it('is a no-op when no record matches the tracking id', () => {
          startPendingSync('sync-tracking-id');
          cdl.recordLocusSyncMessageReceived('meeting-1', 'some-other-tracking-id');

          assert.isUndefined(cdl.meetingLatencies.get('meeting-1')![0].locusSync.messageReceived);
        });

        it('is a no-op when trackingId is empty', () => {
          startPendingSync('sync-tracking-id');

          assert.doesNotThrow(() => cdl.recordLocusSyncMessageReceived('meeting-1', ''));
          assert.isUndefined(cdl.meetingLatencies.get('meeting-1')![0].locusSync.messageReceived);
        });
      });

      describe('completeLocusSyncLatency requires both milestones', () => {
        const recordSyncRequest = (trackingId: string) => {
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.start',
            value: 100,
            options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId},
          });
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.request',
            value: 110,
            options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId},
          });
        };
        const recordSyncResponse = (trackingId: string) =>
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.response',
            value: 130,
            options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId},
          });
        const recordMessageReceived = (trackingId: string) =>
          cdl.saveTimestamp({
            key: 'internal.client.locus.sync.message.received',
            value: 150,
            options: {meetingId: 'meeting-1', dataSetName: 'main', trackingId},
          });

        it('returns undefined and keeps the record when only the /sync response is present', () => {
          recordSyncRequest('sync-tracking-id');
          recordSyncResponse('sync-tracking-id');

          assert.isUndefined(cdl.completeLocusSyncLatency('meeting-1', 'sync-tracking-id'));
          assert.lengthOf(cdl.meetingLatencies.get('meeting-1')!, 1);
        });

        it('returns undefined and keeps the record when only the LLM message is present', () => {
          recordSyncRequest('sync-tracking-id');
          recordMessageReceived('sync-tracking-id');

          assert.isUndefined(cdl.completeLocusSyncLatency('meeting-1', 'sync-tracking-id'));
          assert.lengthOf(cdl.meetingLatencies.get('meeting-1')!, 1);
        });

        it('emits and consumes the record when the /sync response arrives after the LLM message', () => {
          recordSyncRequest('sync-tracking-id');
          // LLM message arrives first, before the HTTP response
          recordMessageReceived('sync-tracking-id');
          assert.isUndefined(cdl.completeLocusSyncLatency('meeting-1', 'sync-tracking-id'));

          // /sync response lands second -> now both milestones are in
          recordSyncResponse('sync-tracking-id');

          assert.deepEqual(cdl.completeLocusSyncLatency('meeting-1', 'sync-tracking-id'), {
            dataSet: 'main',
            syncLatency: {
              randomBackoffTime: 0,
              hashtreePrepTime: 0,
              hashtreeResponseTime: 0,
              syncPrepTime: 10,
              syncResponseTime: 20,
              syncMessageReceiveTime: 40,
              totalTime: 50,
            },
          });
          assert.isUndefined(cdl.meetingLatencies.get('meeting-1'));
        });

        it('emits and consumes the record when the LLM message arrives after the /sync response', () => {
          recordSyncRequest('sync-tracking-id');
          // HTTP response arrives first
          recordSyncResponse('sync-tracking-id');
          assert.isUndefined(cdl.completeLocusSyncLatency('meeting-1', 'sync-tracking-id'));

          // LLM message lands second
          recordMessageReceived('sync-tracking-id');

          const completed = cdl.completeLocusSyncLatency('meeting-1', 'sync-tracking-id');

          assert.isDefined(completed);
          assert.equal(completed!.dataSet, 'main');
          assert.isUndefined(cdl.meetingLatencies.get('meeting-1'));
        });
      });
    });

    it('should calculate diff between timestamps correctly', () => {
      cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
      cdl.saveTimestamp({key: 'client.alert.removed', value: 20});
      const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed');
      assert.deepEqual(res, 10);
    });

    it('it returns undefined if either one is doesnt exist', () => {
      cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
      const res1 = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed');
      assert.deepEqual(res1, undefined);
      const res2 = cdl.getDiffBetweenTimestamps('client.alert.removed', 'client.alert.displayed');
      assert.deepEqual(res2, undefined);
    });

    describe('getDiffBetweenTimestamps with clamping', () => {
      it('should apply default clamping (min: 0, max: 2147483647) when no clampValues provided', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 50});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed');
        assert.deepEqual(res, 40);
      });

      it('should return diff without clamping when value is within range', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 50});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          minimum: 0,
          maximum: 100,
        });
        assert.deepEqual(res, 40);
      });

      it('should clamp to minimum when diff is below minimum', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 50});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 45});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          minimum: 10,
          maximum: 100,
        });
        assert.deepEqual(res, 10);
      });

      it('should clamp to maximum when diff is above maximum', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 210});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          minimum: 0,
          maximum: 100,
        });
        assert.deepEqual(res, 100);
      });

      it('should use default minimum of 0 when only maximum is specified', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 50});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 45});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          maximum: 100,
        });
        assert.deepEqual(res, 0);
      });

      it('should not clamp maximum when maximum is undefined', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 2000});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          minimum: 5,
        });
        assert.deepEqual(res, 1990);
      });

      it('should handle negative differences correctly with clamping', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 100});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 50});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          minimum: 10,
          maximum: 1000,
        });
        assert.deepEqual(res, 10);
      });

      it('should return undefined when timestamps are missing even with clamping', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          minimum: 0,
          maximum: 100,
        });
        assert.deepEqual(res, undefined);
      });

      it('should apply default minimum clamping (0) when no clampValues provided and diff is negative', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 100});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 50});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed');
        assert.deepEqual(res, 0);
      });

      it('should clamp the value when a number greater than 2147483647', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 0});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 2147483648});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed');
        assert.deepEqual(res, 2147483647);
      });
    });

    it('calculates getMeetingInfoReqResp correctly', () => {
      cdl.saveTimestamp({key: 'internal.client.meetinginfo.request', value: 10});
      cdl.saveTimestamp({key: 'internal.client.meetinginfo.response', value: 20});
      assert.deepEqual(cdl.getMeetingInfoReqResp(), 10);
    });

    it('calculates getMeetingInfoReqResp correctly when duplicate requests/responses are sent', () => {
      cdl.saveTimestamp({key: 'internal.client.meetinginfo.request', value: 8});
      cdl.saveTimestamp({key: 'internal.client.meetinginfo.response', value: 18});
      cdl.saveTimestamp({key: 'internal.client.meetinginfo.request', value: 47});
      cdl.saveTimestamp({key: 'internal.client.meetinginfo.response', value: 48});
      assert.deepEqual(cdl.getMeetingInfoReqResp(), 10);
    });

    describe('measureLatency', () => {
      let clock;
      let saveLatencySpy;

      beforeEach(() => {
        clock = sinon.useFakeTimers();

        saveLatencySpy = sinon.stub(cdl, 'saveLatency');
      });

      afterEach(() => {
        clock.restore();
        sinon.restore();
      });

      it('checks measureLatency with accumulate false', async () => {
        const key = 'internal.client.pageJMT';
        const accumulate = false;

        const callbackStub = sinon.stub().callsFake(() => {
          clock.tick(50);
          return Promise.resolve('test');
        });

        // accumulate should be false by default
        const promise = cdl.measureLatency(callbackStub, 'internal.client.pageJMT');

        const resolvedValue = await promise;
        assert.deepEqual(resolvedValue, 'test');
        assert.calledOnceWithExactly(callbackStub);
        assert.calledOnceWithExactly(saveLatencySpy, key, 50, {accumulate});
      });

      it('checks measureLatency with accumulate true', async () => {
        const key = 'internal.download.time';
        const accumulate = true;
        const callbackStub = sinon.stub().callsFake(() => {
          clock.tick(20);
          return Promise.resolve('test123');
        });

        const promise = cdl.measureLatency(callbackStub, 'internal.download.time', accumulate);

        const resolvedValue = await promise;
        assert.deepEqual(resolvedValue, 'test123');
        assert.calledOnceWithExactly(callbackStub);
        assert.calledOnceWithExactly(saveLatencySpy, key, 20, {accumulate});
      });

      it('checks measureLatency when callBack rejects', async () => {
        const key = 'internal.client.pageJMT';
        const accumulate = false;
        const error = new Error('some error');
        const callbackStub = sinon.stub().callsFake(() => {
          clock.tick(50);
          return Promise.reject(error);
        });

        const promise = cdl.measureLatency(callbackStub, 'internal.client.pageJMT', accumulate);

        const rejectedValue = await assert.isRejected(promise);
        assert.deepEqual(rejectedValue, error);
        assert.calledOnceWithExactly(callbackStub);
        assert.calledOnceWithExactly(saveLatencySpy, key, 50, {accumulate});
      });
    });

    describe('getRefreshCaptchaReqResp', () => {
      it('returns undefined when no precomputed value available', () => {
        assert.deepEqual(cdl.getRefreshCaptchaReqResp(), undefined);
      });

      it('returns the correct value', () => {
        cdl.saveLatency('internal.refresh.captcha.time', 123);

        assert.deepEqual(cdl.getRefreshCaptchaReqResp(), 123);
      });

      it('returns the correct whole number', () => {
        cdl.saveLatency('internal.refresh.captcha.time', 321.44);

        assert.deepEqual(cdl.getRefreshCaptchaReqResp(), 321);
      });

      it('returns the correct number when it is greater than 2147483647', () => {
        cdl.saveLatency('internal.refresh.captcha.time', 4294967400);

        assert.deepEqual(cdl.getRefreshCaptchaReqResp(), 2147483647);
      });
    });

    describe('getReachabilityClustersReqResp', () => {
      it('returns undefined when no precomputed value available', () => {
        assert.deepEqual(cdl.getReachabilityClustersReqResp(), undefined);
      });

      it('returns the correct value', () => {
        cdl.saveLatency('internal.get.cluster.time', 123);

        assert.deepEqual(cdl.getReachabilityClustersReqResp(), 123);
      });

      it('returns the correct whole number', () => {
        cdl.saveLatency('internal.get.cluster.time', 321.44);

        assert.deepEqual(cdl.getReachabilityClustersReqResp(), 321);
      });

      it('returns the correct number when it is greater than 2147483647', () => {
        cdl.saveLatency('internal.get.cluster.time', 4294967400);

        assert.deepEqual(cdl.getReachabilityClustersReqResp(), 2147483647);
      });
    });

    describe('getExchangeCITokenJMT', () => {
      it('returns undefined when no precomputed value available', () => {
        assert.deepEqual(cdl.getExchangeCITokenJMT(), undefined);
      });

      it('returns the correct value', () => {
        cdl.saveLatency('internal.exchange.ci.token.time', 123);

        assert.deepEqual(cdl.getExchangeCITokenJMT(), 123);
      });

      it('returns the correct whole number', () => {
        cdl.saveLatency('internal.exchange.ci.token.time', 321.44);

        assert.deepEqual(cdl.getExchangeCITokenJMT(), 321);
      });

      it('returns the correct number when it is greater than 2147483647', () => {
        cdl.saveLatency('internal.exchange.ci.token.time', 4294967400);

        assert.deepEqual(cdl.getExchangeCITokenJMT(), 2147483647);
      });
    });

    describe('saveTimestamp', () => {
      afterEach(() => {
        sinon.restore();
      });

      it('calls saveFirstTimestamp for meeting info request', () => {
        const saveFirstTimestamp = sinon.stub(cdl, 'saveFirstTimestampOnly');
        cdl.saveTimestamp({key: 'internal.client.meetinginfo.request', value: 10});
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 15});
        assert.deepEqual(saveFirstTimestamp.callCount, 1);
      });

      it('calls saveFirstTimestamp for meeting info response', () => {
        const saveFirstTimestamp = sinon.stub(cdl, 'saveFirstTimestampOnly');
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 15});
        cdl.saveTimestamp({key: 'internal.client.meetinginfo.response', value: 20});
        assert.deepEqual(saveFirstTimestamp.callCount, 1);
      });

      it('calls saveFirstTimestamp for remote SDP received', () => {
        const saveFirstTimestamp = sinon.stub(cdl, 'saveFirstTimestampOnly');
        cdl.saveTimestamp({key: 'client.media-engine.remote-sdp-received', value: 10});
        assert.deepEqual(saveFirstTimestamp.callCount, 1);
      });

      it('clears timestamp for remote SDP received when local SDP generated', () => {
        cdl.saveTimestamp({key: 'client.media-engine.remote-sdp-received', value: 10});
        cdl.saveTimestamp({key: 'client.media-engine.local-sdp-generated', value: 20});
        assert.isUndefined(cdl.latencyTimestamps.get('client.media-engine.remote-sdp-received'));
      });
    });

    it('calculates getShowInterstitialTime correctly', () => {
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 10});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 20});
      assert.deepEqual(cdl.getShowInterstitialTime(), 10);
    });

    it('calculates getCallInitJoinReq correctly', () => {
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 5});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.locus.join.request', value: 20});
      // showedToJoinReq = 20-5 = 15, showInterstitialTime = 10-5 = 5, result = 15-5 = 10
      assert.deepEqual(cdl.getCallInitJoinReq(), 10);
    });

    it('calculates getRegisterWDMDeviceJMT correctly', () => {
      cdl.saveTimestamp({key: 'internal.register.device.request', value: 10});
      cdl.saveTimestamp({key: 'internal.register.device.response', value: 20});
      assert.deepEqual(cdl.getRegisterWDMDeviceJMT(), 10);
    });

    it('calculates getJoinReqResp correctly', () => {
      cdl.saveTimestamp({
        key: 'client.locus.join.request',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 20,
      });
      assert.deepEqual(cdl.getJoinReqResp(), 10);
    });

    it('calculates getTurnDiscoveryTime correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.add-media.turn-discovery.start',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'internal.client.add-media.turn-discovery.end',
        value: 20,
      });
      assert.deepEqual(cdl.getTurnDiscoveryTime(), 10);
    });

    it('calculates getLocalSDPGenRemoteSDPRecv correctly', () => {
      cdl.saveTimestamp({
        key: 'client.media-engine.local-sdp-generated',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.media-engine.remote-sdp-received',
        value: 20,
      });
      assert.deepEqual(cdl.getLocalSDPGenRemoteSDPRecv(), 10);
    });

    it('calculates getICESetupTime correctly', () => {
      cdl.saveTimestamp({
        key: 'client.ice.start',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 20,
      });
      assert.deepEqual(cdl.getICESetupTime(), 10);
    });

    it('calculates getAudioICESetupTime correctly', () => {
      cdl.saveTimestamp({
        key: 'client.ice.start',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 20,
      });
      assert.deepEqual(cdl.getAudioICESetupTime(), 10);
    });

    it('calculates getVideoICESetupTime correctly', () => {
      cdl.saveTimestamp({
        key: 'client.ice.start',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 20,
      });
      assert.deepEqual(cdl.getVideoICESetupTime(), 10);
    });

    it('calculates getShareICESetupTime correctly', () => {
      cdl.saveTimestamp({
        key: 'client.ice.start',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 20,
      });
      assert.deepEqual(cdl.getShareICESetupTime(), 10);
    });

    it('calculates getStayLobbyTime correctly', () => {
      cdl.saveTimestamp({
        key: 'client.lobby.entered',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.lobby.exited',
        value: 20,
      });
      assert.deepEqual(cdl.getStayLobbyTime(), 10);
    });

    describe('getStayLobbyTimeCappedBy', () => {
      it('returns 0 when lobbyStartTimestamp is missing', () => {
        cdl.saveTimestamp({key: 'client.media-engine.ready', value: 100});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), 0);
      });

      it('returns undefined when endTimestampKey is missing', () => {
        cdl.saveTimestamp({key: 'client.lobby.entered', value: 10});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), undefined);
      });

      it('uses maximumEndTimestamp when lobby end does not exist', () => {
        cdl.saveTimestamp({key: 'client.lobby.entered', value: 10});
        cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), 40);
      });

      it('uses lobby end when it is before maximumEndTimestamp', () => {
        cdl.saveTimestamp({key: 'client.lobby.entered', value: 10});
        cdl.saveTimestamp({key: 'client.lobby.exited', value: 30});
        cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), 20);
      });

      it('uses maximumEndTimestamp when lobby end is after it', () => {
        cdl.saveTimestamp({key: 'client.lobby.entered', value: 10});
        cdl.saveTimestamp({key: 'client.lobby.exited', value: 60});
        cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), 40);
      });

      it('clamps to 0 when result would be negative', () => {
        cdl.saveTimestamp({key: 'client.lobby.entered', value: 100});
        cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), 0);
      });

      it('clamps to MAX_INTEGER when result is very large', () => {
        cdl.saveTimestamp({key: 'client.lobby.entered', value: 0});
        cdl.saveTimestamp({key: 'client.media-engine.ready', value: 2147483648});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), 2147483647);
      });
    });

    it('calculates getPageJMT correctly', () => {
      cdl.saveLatency('internal.client.pageJMT', 10);
      assert.deepEqual(cdl.getPageJMT(), 10);
    });

    it('calculates getPageJMT correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.client.pageJMT', 2147483648);
      assert.deepEqual(cdl.getPageJMT(), 2147483647);
    });

    it('calculates getClickToInterstitial correctly', () => {
      cdl.saveLatency('internal.click.to.interstitial', 5);
      assert.deepEqual(cdl.getClickToInterstitial(), 5);
    });

    it('calculates getClickToInterstitial correctly when it is 0', () => {
      cdl.saveLatency('internal.click.to.interstitial', 0);
      assert.deepEqual(cdl.getClickToInterstitial(), 0);
    });

    it('calculates getClickToInterstitial correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.click.to.interstitial', 2147483648);
      assert.deepEqual(cdl.getClickToInterstitial(), 2147483647);
    });

    it('calculates getClickToInterstitialWithUserDelay correctly', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 5);
      assert.deepEqual(cdl.getClickToInterstitialWithUserDelay(), 5);
    });

    it('calculates getClickToInterstitialWithUserDelay correctly when it is 0', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 0);
      assert.deepEqual(cdl.getClickToInterstitialWithUserDelay(), 0);
    });

    it('calculates getClickToInterstitialWithUserDelay correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 2147483648);
      assert.deepEqual(cdl.getClickToInterstitialWithUserDelay(), 2147483647);
    });

    it('calculates getInterstitialToJoinOK correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 20,
      });
      // showedToJoinResp = 20-5 = 15, showInterstitialTime = 10-5 = 5, result = 15-5 = 10
      assert.deepEqual(cdl.getInterstitialToJoinOK(), 10);
    });

    it('calculates getInterstitialToJoinOK correctly when one value is not a number', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 'ten' as unknown as number,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 20,
      });
      assert.deepEqual(cdl.getInterstitialToJoinOK(), undefined);
    });

    it('calculates getCallInitMediaEngineReady correctly', () => {
      sinon.stub(cdl, 'getInterstitialToMediaOKJMT').returns(42);
      assert.deepEqual(cdl.getCallInitMediaEngineReady(), 42);
    });

    it('calculates getTotalJMT correctly', () => {
      cdl.saveLatency('internal.click.to.interstitial', 10);
      cdl.saveTimestamp({
        key: 'internal.client.meeting.click.joinbutton',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 25,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      // clickToInterstitial = 20-10 = 10
      // showedToJoinLocusResponse = 40-20 = 20
      // showInterstitialTime = 25-20 = 5
      // total = 10 + 20 - 5 = 25
      assert.deepEqual(cdl.getTotalJMT(), 25);
    });

    it('calculates getTotalJMT correctly when clickToInterstitial is 0', () => {
      cdl.saveLatency('internal.click.to.interstitial', 0);
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      // showedToJoinLocusResponse = 40-20 = 20, showInterstitialTime = 0
      // total = 0 + 20 - 0 = 20
      assert.deepEqual(cdl.getTotalJMT(), 20);
    });

    it('calculates getTotalJMT correctly when interstitialClickJoinToJoinLocusResponse is 0', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 40,
      });
      cdl.saveLatency('internal.click.to.interstitial', 12);
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      // showedToJoinLocusResponse = 0, showInterstitialTime = 0
      // total = 12 + 0 - 0 = 12
      assert.deepEqual(cdl.getTotalJMT(), 12);
    });

    it('calculates getTotalJMT correctly when both clickToInterstitial and interstitialClickJoinToJoinLocusResponse are 0', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 40,
      });
      cdl.saveLatency('internal.click.to.interstitial', 0);
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMT(), 0);
    });

    it('calculates getTotalJMT correctly when both clickToInterstitial is not a number', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 40,
      });
      cdl.saveLatency('internal.click.to.interstitial', 'eleven' as unknown as number);
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMT(), undefined);
    });

    it('calculates getTotalJMT correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      cdl.saveLatency('internal.click.to.interstitial', 2147483648);
      assert.deepEqual(cdl.getTotalJMT(), 2147483647);
    });

    it('calculates getTotalJMTWithUserDelay correctly', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 10);
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMTWithUserDelay(), 30);
    });

    it('calculates getTotalJMTWithUserDelay correctly when clickToInterstitialWithUserDelay is 0', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 0);
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMTWithUserDelay(), 20);
    });

    it('calculates getTotalJMTWithUserDelay correctly when interstitialShowedToJoinLocusResponse is 0', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 40,
      });
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 12);
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMTWithUserDelay(), 12);
    });

    it('calculates getTotalJMTWithUserDelay correctly when both clickToInterstitialWithUserDelay and interstitialShowedToJoinLocusResponse are 0', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 40,
      });
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 0);
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMTWithUserDelay(), 0);
    });

    it('calculates getTotalJMTWithUserDelay correctly when both clickToInterstitialWithUserDelay is not a number', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 40,
      });
      cdl.saveLatency(
        'internal.click.to.interstitial.with.user.delay',
        'eleven' as unknown as number
      );
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMTWithUserDelay(), undefined);
    });

    it('calculates getTotalJMTWithUserDelay correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 2147483648);
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMTWithUserDelay(), 2147483647);
    });

    it('calculates getTotalMediaJMT correctly with lobby exiting before media-engine.ready', () => {
      cdl.saveLatency('internal.click.to.interstitial', 3);
      // clickToInterstitial = 3
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 8});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      // interstitialShowedToMediaEngineReady = 50 - 8 = 42
      // showInterstitialTime = 10 - 8 = 2
      cdl.saveTimestamp({key: 'client.lobby.entered', value: 20});
      cdl.saveTimestamp({key: 'client.lobby.exited', value: 30});
      // stayLobbyTimeCappedByMediaEngineReady = min(30, 50) - 20 = 10
      // total = 3 + 42 - 2 - 10 = 33
      assert.deepEqual(cdl.getTotalMediaJMT(), 33);
    });

    it('calculates getTotalMediaJMT correctly without lobby', () => {
      cdl.saveLatency('internal.click.to.interstitial', 3);
      // clickToInterstitial = 3
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 8});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      // interstitialShowedToMediaEngineReady = 50 - 8 = 42
      // showInterstitialTime = 10 - 8 = 2
      // no client.lobby.entered → stayLobbyTimeCappedByMediaEngineReady = 0
      // total = 3 + 42 - 2 - 0 = 43
      assert.deepEqual(cdl.getTotalMediaJMT(), 43);
    });

    it('calculates getTotalMediaJMT correctly with lobby exiting after media-engine.ready', () => {
      cdl.saveLatency('internal.click.to.interstitial', 3);
      // clickToInterstitial = 3
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 8});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      // interstitialShowedToMediaEngineReady = 50 - 8 = 42
      // showInterstitialTime = 10 - 8 = 2
      cdl.saveTimestamp({key: 'client.lobby.entered', value: 20});
      cdl.saveTimestamp({key: 'client.lobby.exited', value: 60});
      // stayLobbyTimeCappedByMediaEngineReady = min(60, 50) - 20 = 30
      // total = 3 + 42 - 2 - 30 = 13
      assert.deepEqual(cdl.getTotalMediaJMT(), 13);
    });

    it('calculates getTotalMediaJMT correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.click.to.interstitial', 5);
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 10});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 4294967400});
      cdl.saveTimestamp({key: 'client.lobby.entered', value: 28});
      cdl.saveTimestamp({key: 'client.lobby.exited', value: 30});
      assert.deepEqual(cdl.getTotalMediaJMT(), 2147483647);
    });

    it('returns undefined for getTotalMediaJMT when media-engine.ready is missing', () => {
      cdl.saveLatency('internal.click.to.interstitial', 3);
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 8});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.locus.join.response', value: 20});
      assert.deepEqual(cdl.getTotalMediaJMT(), undefined);
    });

    it('calculates getTotalMediaJMT correctly when there is no lobby and stayLobbyTime defaults to 0', () => {
      cdl.saveLatency('internal.click.to.interstitial', 3);
      // clickToInterstitial = 3
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 8});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      // interstitialShowedToMediaEngineReady = 50 - 8 = 42
      // showInterstitialTime = 10 - 8 = 2
      // no client.lobby.entered → stayLobbyTimeCappedByMediaEngineReady = 0
      // total = 3 + 42 - 2 - 0 = 43
      assert.deepEqual(cdl.getTotalMediaJMT(), 43);
    });

    it('calculates getTotalMediaJMTWithUserDelay correctly', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 7);
      // clickToInterstitialWithUserDelay = 7
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      // interstitialShowedToMediaEngineReady = 50 - 10 = 40
      // total = 7 + 40 = 47
      assert.deepEqual(cdl.getTotalMediaJMTWithUserDelay(), 47);
    });

    it('calculates getTotalMediaJMTWithUserDelay correctly for guest join', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 3);
      // clickToInterstitialWithUserDelay = 3
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 8});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      // interstitialShowedToMediaEngineReady = 50 - 8 = 42
      // total = 3 + 42 = 45
      assert.deepEqual(cdl.getTotalMediaJMTWithUserDelay(), 45);
    });

    it('returns undefined for getTotalMediaJMTWithUserDelay when media-engine.ready is missing', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 7);
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 10});
      assert.deepEqual(cdl.getTotalMediaJMTWithUserDelay(), undefined);
    });

    it('calculates getTotalMediaJMTWithUserDelay correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 2147483648);
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      assert.deepEqual(cdl.getTotalMediaJMTWithUserDelay(), 2147483647);
    });

    it('calculates getJoinConfJMT correctly', () => {
      cdl.saveTimestamp({
        key: 'client.locus.join.request',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'client.ice.start',
        value: 30,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 40,
      });
      assert.deepEqual(cdl.getJoinConfJMT(), 20);
    });

    it('calculates getJoinConfJMT correctly when it is greater than MAX_INTEGER', () => {
      // Since both getJoinReqResp and getICESetupTime are individually clamped to 1200000,
      // the maximum possible sum is 2400000, which is less than MAX_INTEGER (2147483647).
      // This test should verify that the final clamping works by mocking the intermediate methods
      // to return values that would sum to more than MAX_INTEGER.

      const originalGetJoinReqResp = cdl.getJoinReqResp;
      const originalGetICESetupTime = cdl.getICESetupTime;

      // Mock the methods to return large values that would exceed MAX_INTEGER when summed
      cdl.getJoinReqResp = () => 1500000000;
      cdl.getICESetupTime = () => 1000000000;

      const result = cdl.getJoinConfJMT();

      // Restore original methods
      cdl.getJoinReqResp = originalGetJoinReqResp;
      cdl.getICESetupTime = originalGetICESetupTime;

      assert.deepEqual(result, 2147483647);
    });

    it('calculates getClientJMT correctly', () => {
      cdl.saveLatency('internal.click.to.interstitial.for.client.jmt', 5);
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 1,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 2,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.request',
        value: 6,
      });
      // showedToLocusJoinRequest = 6-1 = 5, showInterstitialTime = 2-1 = 1
      // clickToInterstitialForClientJmt (5) + 5 - 1 = 9
      assert.deepEqual(cdl.getClientJMT(), 9);
    });

    it('returns undefined for getClientJMT when clickToInterstitialForClientJmt is missing', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 1,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 2,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.request',
        value: 6,
      });
      assert.deepEqual(cdl.getClientJMT(), undefined);
    });

    it('returns undefined for getClientJMT when interstitialJoinToLocusJoinRequest is missing', () => {
      cdl.saveLatency('internal.click.to.interstitial.for.client.jmt', 5);
      assert.deepEqual(cdl.getClientJMT(), undefined);
    });

    it('calculates getAudioJoinRespRxStart correctly', () => {
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'client.media.rx.start',
        value: 7,
      });
      assert.deepEqual(cdl.getAudioJoinRespRxStart(), 2);
    });

    it('calculates getVideoJoinRespRxStart correctly', () => {
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'client.media.rx.start',
        value: 7,
      });
      assert.deepEqual(cdl.getVideoJoinRespRxStart(), 2);
    });

    it('calculates getAudioJoinRespTxStart correctly', () => {
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'client.media.tx.start',
        value: 7,
      });
      assert.deepEqual(cdl.getAudioJoinRespTxStart(), 2);
    });

    it('calculates getVideoJoinRespTxStart correctly', () => {
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'client.media.tx.start',
        value: 7,
      });
      assert.deepEqual(cdl.getVideoJoinRespTxStart(), 2);
    });

    it('calculates getInterstitialToMediaOKJMT correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 2,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 4,
      });
      cdl.saveTimestamp({
        key: 'client.lobby.entered',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.lobby.exited',
        value: 12,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 14,
      });
      // showedToIceEnd = 14-2 = 12, showInterstitialTime = 4-2 = 2
      // stayLobbyTimeCappedByIceEnd = min(12,14)-10 = 2
      // result = 12 - 2 - 2 = 8
      assert.deepEqual(cdl.getInterstitialToMediaOKJMT(), 8);
    });

    it('calculates getInterstitialToMediaOKJMT correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 4,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 4,
      });
      cdl.saveTimestamp({
        key: 'client.lobby.entered',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.lobby.exited',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 2147483700,
      });
      assert.deepEqual(cdl.getInterstitialToMediaOKJMT(), 2147483647);
    });

    it('calculates getInterstitialToMediaOKJMT correctly without lobby', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 2,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 4,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 14,
      });
      // showedToIceEnd = 14-2 = 12, showInterstitialTime = 4-2 = 2
      // stayLobbyTimeCappedByIceEnd = 0 (no lobby)
      // result = 12 - 2 - 0 = 10
      assert.deepEqual(cdl.getInterstitialToMediaOKJMT(), 10);
    });

    it('calculates getInterstitialToMediaOKJMT correctly when there is no lobby and stayLobbyTime defaults to 0', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 2,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 4,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 14,
      });
      // showedToIceEnd = 14-2 = 12, showInterstitialTime = 4-2 = 2
      // stayLobbyTimeCappedByIceEnd = 0 (no lobby)
      // result = 12 - 2 - 0 = 10
      assert.deepEqual(cdl.getInterstitialToMediaOKJMT(), 10);
    });

    it('calculates getShareDuration correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.share.initiated',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'internal.client.share.stopped',
        value: 7,
      });
      assert.deepEqual(cdl.getShareDuration(), 2);
    });

    describe('calculates getU2CTime correctly', () => {
      it('returns undefined when no precomputed value available', () => {
        assert.deepEqual(cdl.getU2CTime(), undefined);
      });

      it('returns the correct value', () => {
        cdl.saveLatency('internal.get.u2c.time', 123);

        assert.deepEqual(cdl.getU2CTime(), 123);
      });

      it('returns the correct whole number', () => {
        cdl.saveLatency('internal.get.u2c.time', 321.44);

        assert.deepEqual(cdl.getU2CTime(), 321);
      });
    });

    it('calculates getDownloadTimeJMT correctly', () => {
      cdl.saveLatency('internal.download.time', 1000);
      assert.deepEqual(cdl.getDownloadTimeJMT(), 1000);
    });

    it('calculates getDownloadTimeJMT correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.download.time', 2147483648);
      assert.deepEqual(cdl.getDownloadTimeJMT(), 2147483647);
    });

    describe('getOtherAppApiReqResp', () => {
      it('returns undefined when no precomputed value available', () => {
        assert.deepEqual(cdl.getOtherAppApiReqResp(), undefined);
      });

      it('returns undefined if it is less than 0', () => {
        cdl.saveLatency('internal.other.app.api.time', 0);

        assert.deepEqual(cdl.getOtherAppApiReqResp(), undefined);
      });

      it('returns the correct value', () => {
        cdl.saveLatency('internal.other.app.api.time', 123);

        assert.deepEqual(cdl.getOtherAppApiReqResp(), 123);
      });

      it('returns the correct whole number', () => {
        cdl.saveLatency('internal.other.app.api.time', 321.44);

        assert.deepEqual(cdl.getOtherAppApiReqResp(), 321);
      });

      it('returns the correct number when it is greater than 2147483647', () => {
        cdl.saveLatency('internal.other.app.api.time', 4294967400);

        assert.deepEqual(cdl.getOtherAppApiReqResp(), 2147483647);
      });
    });
  });
});
