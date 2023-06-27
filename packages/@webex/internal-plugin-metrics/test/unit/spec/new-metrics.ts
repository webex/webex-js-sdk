import NewMetrics from '../../../src/new-metrics';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

describe("internal-plugin-metrics", () => {
  describe("new-metrics", () => {
    beforeEach(() => {
      NewMetrics.callDiagnosticLatencies.saveTimestamp = sinon.stub();
      NewMetrics.callDiagnosticMetrics.submitClientEvent = sinon.stub();
      NewMetrics.callDiagnosticMetrics.submitMQE = sinon.stub();
    });

    it('submits Client Event successfully', () => {
      NewMetrics.submitClientEvent({
        name: 'client.alert.displayed',
        options: {
          meetingId: '123',
        }
      });

      assert.calledWith(NewMetrics.callDiagnosticLatencies.saveTimestamp, "client.alert.displayed")
      assert.calledWith(NewMetrics.callDiagnosticMetrics.submitClientEvent, {
        name: 'client.alert.displayed',
        payload: undefined,
        options: { meetingId: '123' }
      })
    });

    it('submits MQE successfully', () => {
      NewMetrics.submitMQE({
        name: 'client.mediaquality.event',
        //@ts-ignore
        payload: {intervals: [{}]},
        options: {
          meetingId: '123',
          networkType: 'wifi'
        }
      });

      assert.calledWith(NewMetrics.callDiagnosticLatencies.saveTimestamp, 'client.mediaquality.event')
      assert.calledWith(NewMetrics.callDiagnosticMetrics.submitMQE, {
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
