import {assert} from '@webex/test-helper-chai';
import {NewMetrics} from '@webex/internal-plugin-metrics';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

describe("internal-plugin-metrics", () => {
  describe("new-metrics", () => {
    let webex;

    beforeEach(() => {
      //@ts-ignore
      webex = new MockWebex({
        children: {
          newMetrics: NewMetrics
        },
        meetings: {
          meetingCollection: {
            get: sinon.stub()
          }
        }
      });

      webex.emit('ready');

      webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.submitClientEvent = sinon.stub();
      webex.internal.newMetrics.callDiagnosticMetrics.submitMQE = sinon.stub();
    });

    it('submits Client Event successfully', () => {
      webex.internal.newMetrics.submitClientEvent({
        name: 'client.alert.displayed',
        options: {
          meetingId: '123',
        }
      });

      assert.calledWith(webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp, "client.alert.displayed")
      assert.calledWith(webex.internal.newMetrics.callDiagnosticMetrics.submitClientEvent, {
        name: 'client.alert.displayed',
        payload: undefined,
        options: { meetingId: '123' }
      })
    });

    it('submits MQE successfully', () => {
      webex.internal.newMetrics.submitMQE({
        name: 'client.mediaquality.event',
        //@ts-ignore
        payload: {intervals: [{}]},
        options: {
          meetingId: '123',
          networkType: 'wifi'
        }
      });

      assert.calledWith(webex.internal.newMetrics.callDiagnosticLatencies.saveTimestamp, 'client.mediaquality.event')
      assert.calledWith(webex.internal.newMetrics.callDiagnosticMetrics.submitMQE, {
        name: 'client.mediaquality.event',
        //@ts-ignore
        payload: {intervals: [{}]},
        options: {
          meetingId: '123',
          networkType: 'wifi'
        }
      })
    });
  })
})
