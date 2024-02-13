import {assert} from '@webex/test-helper-chai';
import {NewMetrics} from '@webex/internal-plugin-metrics';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {Utils} from '@webex/internal-plugin-metrics';

describe('internal-plugin-metrics', () => {

  describe('check submitClientEvent when webex is not ready', () => {
    let webex;
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
      request: sinon.stub().resolves({}),
      logger: {
        log: sinon.stub(),
        error: sinon.stub(),
      }
    });

    it('checks the log', () => {
      webex.internal.newMetrics.submitClientEvent({
        name: 'client.alert.displayed',
        options: {
          meetingId: '123',
        },
      });
      assert.calledWith(
        webex.logger.log,
        'NewMetrics: @submitClientEvent. Attempted to submit before webex.ready. Event name: client.alert.displayed'
      );
    });
  });

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
        request: sinon.stub().resolves({}),
        logger: {
          log: sinon.stub(),
          error: sinon.stub(),
        }
      });

      webex.emit('ready');

      webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp = sinon.stub();
      webex.internal.newMetrics.callDiagnosticLatencies.clearTimestamps = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.submitClientEvent = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.submitMQE = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.clientMetricsAliasUser = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.postPreLoginMetric = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.buildClientEventFetchRequestOptions =
        sinon.stub();
      webex.setTimingsAndFetch = sinon.stub();
    });

    afterEach(() => {
      sinon.restore();
    })

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

    describe('#clientMetricsAliasUser', () => {
      it('aliases the user correctly', async () => {
        webex.request.resolves({response: 'abc'});
        await webex.internal.newMetrics.clientMetricsAliasUser('my-id');
        assert.calledWith(webex.request, {
          method: 'POST',
          api: 'metrics',
          resource: 'clientmetrics',
          headers: { 'x-prelogin-userid': 'my-id' },
          body: {},
          qs: { alias: true },
        });
        assert.calledWith(
          webex.logger.log,
          'NewMetrics: @clientMetricsAliasUser. Request successful.'
        );
      });

      it('handles failed request correctly', async () => {
        webex.request.rejects(new Error("test error"));
        sinon.stub(Utils, 'generateCommonErrorMetadata').returns('formattedError')
        try {
          await webex.internal.newMetrics.clientMetricsAliasUser({event: 'test'}, 'my-id');
        } catch (err) {
          assert.calledWith(
            webex.logger.error,
            'NewMetrics: @clientMetricsAliasUser. Request failed:',
            `err: formattedError`
          );
        }
      });
    });

    describe('#postPreLoginMetric', () => {
      it('sends the request correctly', async () => {
        webex.request.resolves({response: 'abc'});
        await webex.internal.newMetrics.postPreLoginMetric({event: 'test'}, 'my-id');
        assert.calledWith(webex.request, {
          method: 'POST',
          api: 'metrics',
          resource: 'clientmetrics-prelogin',
          headers: { 'x-prelogin-userid': 'my-id', authorization: false },
          body: {metrics: [{event: 'test'}]},
        });
        assert.calledWith(
          webex.logger.log,
          'NewMetrics: @postPreLoginMetric. Request successful.'
        );
      });

      it('handles failed request correctly', async () => {
        webex.request.rejects(new Error("test error"));
        sinon.stub(Utils, 'generateCommonErrorMetadata').returns('formattedError')
        try {
          await webex.internal.newMetrics.postPreLoginMetric({event: 'test'}, 'my-id');
        } catch (err) {
          assert.calledWith(
            webex.logger.error,
            'NewMetrics: @postPreLoginMetric. Request failed:',
            `err: formattedError`
          );
        }
      });
    })

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
