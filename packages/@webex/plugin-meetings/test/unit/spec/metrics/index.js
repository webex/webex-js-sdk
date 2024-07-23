/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import sinon from 'sinon';
import Metrics from '@webex/internal-plugin-metrics';
import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';

import metrics from '@webex/plugin-meetings/src/metrics';

/**
 * Meeting can only run in a browser, so we can only send metrics for
 * browser usage.
 */
describe('Meeting metrics', () => {
  let webex, mockSubmitMetric, sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockSubmitMetric = sandbox.stub();
    webex = new MockWebex({
      children: {
        metrics: Metrics,
      },
    });

    webex.config.metrics.type = ['behavioral'];
    webex.internal.metrics.submitClientMetrics = mockSubmitMetric;
    metrics.initialSetup(webex);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#sendBehavioralMetric', () => {
    it('sends client metric via Metrics plugin', () => {
      metrics.sendBehavioralMetric('myMetric');

      assert.calledOnce(mockSubmitMetric);
    });

    it('adds environment information to metric', () => {
      const fields = {value: 567};
      const metricTags = {test: true};

      metrics.sendBehavioralMetric('myMetric', fields, metricTags);

      assert.calledWithMatch(mockSubmitMetric, 'myMetric', {
        type: ['behavioral'],
        fields: {
          value: 567,
        },
        tags: {
          test: true,
        },
      });
    });
  });

  describe('prepareMetricFields', () => {
    it('handles empty objects correctly', () => {
      const result = metrics.prepareMetricFields({});

      assert.deepEqual(result, {});
    });

    it('handles literal values correctly', () => {
      assert.deepEqual(metrics.prepareMetricFields('any string'), {value: 'any string'});
      assert.deepEqual(metrics.prepareMetricFields(999), {value: 999});
      assert.deepEqual(metrics.prepareMetricFields(null), {value: null});
      assert.deepEqual(metrics.prepareMetricFields(true), {value: true});
      assert.deepEqual(metrics.prepareMetricFields(false), {value: false});
    });

    it('handles simple objects correctly', () => {
      const result = metrics.prepareMetricFields({
        someStringProp: 'some string',
        numberProp: 100,
        booleanPropFalse: false,
        booleanPropTrue: true,
      });

      assert.deepEqual(result, {
        someStringProp: 'some string',
        numberProp: 100,
        booleanPropFalse: false,
        booleanPropTrue: true,
      });
    });

    it('handles nested objects correctly', () => {
      const result = metrics.prepareMetricFields({
        someStringProp: 'some string',
        nestedObject: {
          stringProp: 'another string',
          numberProp: 1234,
          deepObject: {
            oneMoreString: 'deep nested string',
            someBoolean: true,
            oneMoreNumber: 10,
          },
        },
      });

      assert.deepEqual(result, {
        someStringProp: 'some string',
        nestedObject_stringProp: 'another string',
        nestedObject_numberProp: 1234,
        nestedObject_deepObject_oneMoreString: 'deep nested string',
        nestedObject_deepObject_someBoolean: true,
        nestedObject_deepObject_oneMoreNumber: 10,
      });
    });

    it('handles arrays correctly', () => {
      const result = metrics.prepareMetricFields(['a string', 10, true, false, {id: 'object id'}]);

      assert.deepEqual(result, {
        0: 'a string',
        1: 10,
        2: true,
        3: false,
        '4_id': 'object id',
      });
    });

    it('handles arrays nested in objects correctly', () => {
      const result = metrics.prepareMetricFields({
        something: 10,
        anObject: {
          someArray: ['a string', 10, true, false, {id: 'object id'}],
        },
      });

      assert.deepEqual(result, {
        something: 10,
        anObject_someArray_0: 'a string',
        anObject_someArray_1: 10,
        anObject_someArray_2: true,
        anObject_someArray_3: false,
        anObject_someArray_4_id: 'object id',
      });
    });

    it('handles arrays nested in arrays correctly', () => {
      const result = metrics.prepareMetricFields({
        something: 10,
        topLevelArray: [
          [1, 2, 'three', {prop1: '1st prop of object 1', prop2: '2nd prop of object 1'}],
          [10, 20, 'thirty', {prop1: '1st prop of object 2', prop2: '2nd prop of object 2'}],
        ],
      });

      assert.deepEqual(result, {
        something: 10,
        topLevelArray_0_0: 1,
        topLevelArray_0_1: 2,
        topLevelArray_0_2: 'three',
        topLevelArray_0_3_prop1: '1st prop of object 1',
        topLevelArray_0_3_prop2: '2nd prop of object 1',
        topLevelArray_1_0: 10,
        topLevelArray_1_1: 20,
        topLevelArray_1_2: 'thirty',
        topLevelArray_1_3_prop1: '1st prop of object 2',
        topLevelArray_1_3_prop2: '2nd prop of object 2',
      });
    });
  });
});
