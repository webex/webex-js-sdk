import {forEach, isFinite, isArray} from 'lodash';

import {
  ANALYSIS_STATS,
  ANALYSIS_CHECKS
} from '../constants';
import ParameterError from '../common/errors/parameter';

const StatsAnalyzer = {};

/**
 * Can involve changing of the default plugin-meetings sdk for deeper results
 * @param {Array} series of WebRTCData
 * @param {Object} options
 * @param {Array} options.analysisKeys [{key: 'bytesSent', check: 'increasing'}, {key: 'bytesReceived', check: 'increasing'}]
 * @returns {Object} analysis {valid: true/false, failed: { key: [number] }, data: { webRtcKeyToAnalyze: { valid: true/false, reports: [ { value: number, valid: true/false, difference: number } ] } } }
 * @public
 */
StatsAnalyzer.analyze = (series, options = {analysisKeys: ANALYSIS_STATS.DEFAULT_KEYS}) => {
  if (!isArray(series) || !series.length || !options || !isArray(options.analysisKeys) || !options.analysisKeys.length) {
    throw new ParameterError('analyzer->analyze#series must be defined as a nonempty array of WebRTCData objects, and options.analysisKeys must be a nonempty array of strings, representing the properties to analyze.');
  }
  const properties = new Set(options.analysisKeys);
  const analysis = {valid: true, failed: {}, data: {}};

  properties.forEach((config) => {
    const property = config.key;

    analysis.data[property] = {valid: true, reports: []};
    analysis.failed[property] = [];
    let previous = {value: 0};
    let index = 0;

    for (let i = series.length - 1; i > 0; i -= 1) {
      const singular = {};

      forEach(series[i].data.getData()[config.prop], (webrtcData) => { // eslint-disable-line
        const value = webrtcData[property];

        if (!value || !isFinite(value)) {
          return;
        }
        singular.value = value;
        singular.difference = 0;
        singular.valid = false;
        singular.index = index;
        singular.difference = singular.value - previous.value;
        if (config.check === ANALYSIS_CHECKS.INCREASING && singular.difference > 0) {
          singular.valid = true;
        }
        else if (config.check === ANALYSIS_CHECKS.DECREASING && singular.difference < 0) {
          singular.valid = true;
        }
        else if (config.check === ANALYSIS_CHECKS.CONSTANT) {
          singular.valid = true;
        }
        else {
          singular.valid = false;
        }
        if (!singular.valid) {
          analysis.data[property].valid = false;
          analysis.valid = false;
          analysis.failed[property].push(i);
        }
        previous = singular;
        analysis.data[property].reports.push(singular);
      });
      index += 1;
    }
    if (!analysis.data[property].valid) {
      analysis.valid = false;
    }
  });

  return analysis;
};

export default StatsAnalyzer;
