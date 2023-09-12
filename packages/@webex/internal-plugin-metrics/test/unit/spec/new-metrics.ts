import {assert} from '@webex/test-helper-chai';
import {NewMetrics} from '@webex/internal-plugin-metrics';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

describe('internal-plugin-metrics', () => {
  describe('new-metrics', () => {
    let webex;

    beforeEach(() => {
      //@ts-ignore
      webex = new MockWebex({
        children: {
          newMetrics: NewMetrics,
        },
        meetings: {
          meetingCollection: {
            get: sinon.stub(),
          },
        },
      });

      webex.emit('ready');

      webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp = sinon.stub();
      webex.internal.newMetrics.callDiagnosticLatencies.clearTimestamps = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.submitClientEvent = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.submitMQE = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.buildClientEventFetchRequestOptions =
        sinon.stub();
      webex.setTimingsAndFetch = sinon.stub();
    });

    it('submits Client Event successfully', () => {
      webex.internal.newMetrics.submitClientEvent({
        name: 'client.alert.displayed',
        options: {
          meetingId: '123',
        },
      });

      assert.calledWith(webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp, {
        key: 'client.alert.displayed',
        options: {meetingId: '123'},
      });
      assert.calledWith(webex.internal.newMetrics.callDiagnosticMetrics.submitClientEvent, {
        name: 'client.alert.displayed',
        payload: undefined,
        options: {meetingId: '123'},
      });
    });

    it('submits MQE successfully', () => {
      webex.internal.newMetrics.submitMQE({
        name: 'client.mediaquality.event',
        //@ts-ignore
        payload: {intervals: [{}]},
        options: {
          meetingId: '123',
          networkType: 'wifi',
        },
      });

      assert.calledWith(webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp, {
        key: 'client.mediaquality.event',
      });
      assert.calledWith(webex.internal.newMetrics.callDiagnosticMetrics.submitMQE, {
        name: 'client.mediaquality.event',
        //@ts-ignore
        payload: {intervals: [{}]},
        options: {
          meetingId: '123',
          networkType: 'wifi',
        },
      });
    });

    it('submits Internal Event successfully', () => {
      webex.internal.newMetrics.submitInternalEvent({
        name: 'client.mediaquality.event',
      });

      assert.calledWith(webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp, {
        key: 'client.mediaquality.event',
      });
      assert.notCalled(webex.internal.newMetrics.callDiagnosticLatencies.clearTimestamps);
    });

    it('submits Internal Event successfully for clearing the join latencies', () => {
      webex.internal.newMetrics.submitInternalEvent({
        name: 'internal.reset.join.latencies',
      });

      assert.notCalled(webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp);
      assert.calledOnce(webex.internal.newMetrics.callDiagnosticLatencies.clearTimestamps);
    });

    describe('#buildClientEventFetchRequestOptions', () => {
      it('builds client event fetch options successfully', () => {
        webex.internal.newMetrics.buildClientEventFetchRequestOptions({
          name: 'client.alert.displayed',
          options: {
            meetingId: '123',
          },
        });

        assert.calledWith(
          webex.internal.newMetrics.callDiagnosticMetrics.buildClientEventFetchRequestOptions,
          {
            name: 'client.alert.displayed',
            payload: undefined,
            options: {meetingId: '123'},
          }
        );
      });
    });

    describe('#setMetricTimingsAndFetch', () => {
      beforeEach(() => {
        global.fetch = sinon.stub();
      });

      it('calls fetch with the expected options', () => {
        const now = new Date();
        sinon.useFakeTimers(now.getTime());

        webex.internal.newMetrics.setMetricTimingsAndFetch({
          json: true,
          body: JSON.stringify({metrics: [{eventPayload: {}}]}),
        });

        const expected = {
          json: true,
          body: JSON.stringify({
            metrics: [
              {
                eventPayload: {
                  originTime: {
                    triggered: now.toISOString(),
                    sent: now.toISOString(),
                  },
                },
              },
            ],
          }),
        };

        sinon.assert.calledOnce(webex.setTimingsAndFetch);
        sinon.assert.calledWith(webex.setTimingsAndFetch, expected);

        sinon.restore();
      });
    });
  });
});
