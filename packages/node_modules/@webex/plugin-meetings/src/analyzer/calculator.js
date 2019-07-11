import {keys, isFinite} from 'lodash';

import {DEFAULT_EXCLUDED_STATS} from '../constants';

const StatsCalculator = {};

/**
 * Calculate an interval of values between 2 data points, using updated as the "latest" so updated - previous = interval
 * @param {WebRTCData} previous
 * @param {WebRTCData} updated
 * @returns {Object} interval: {StringKey: IntervalValue, ..., n}
 * @public
 */
StatsCalculator.difference = (previous, updated) => {
  // if there was no previous, just take the updated
  if (!previous || !previous.data || !previous.data.getData || keys(previous.data.getData()).length === 0) {
    return updated;
  }
  const interval = {};

  // get inside the data from the filtered report
  keys(updated.data.getData()).forEach((key) => {
    interval[key] = interval[key] ? interval[key] : {};
    keys(updated.data.getData()[key]).forEach((stat) => {
      let value = updated.data.getData()[key][stat];

      // only use some simple data points that are numbers and aren't silly things like timestamp
      if (isFinite(value) && !(DEFAULT_EXCLUDED_STATS.includes(stat) && value !== 0)) {
        // if there was nothing there before, just return the updated data
        if (!previous.data.getData()[key] || !previous.data.getData()[key][stat]) {
          interval[key][stat] = value;
        }
        // subract and store
        else {
          value -= previous.data.getData()[key][stat];
          interval[key][stat] = value;
        }
      }
    });
  });

  return interval;
};

/**
 * Calculate an aggregate of values between an old summary and a new data point, using summary as the base to add to so aggregate = summary + data
 * @param {WebRTCData} data
 * @param {Object} summary
 * @returns {Object} aggregate {StringKey: SummedValue, ..., n}
 * @public
 */
StatsCalculator.sum = (data, summary) => {
  const aggregate = summary;

  // get inside the data from the filtered report
  keys(data.data.getData()).forEach((key) => {
    keys(data.data.getData()[key]).forEach((stat) => {
      const value = data.data.getData()[key][stat];

      // only use some simple data points that are numbers and aren't silly things like timestamp
      if (isFinite(value) && !(DEFAULT_EXCLUDED_STATS.includes(stat) && value !== 0)) {
        // if there was something there before, add to that value
        if (aggregate[key][stat]) {
          aggregate[key][stat] += value;
        }
        // set up the value as the new data point
        else {
          aggregate[key][stat] = value;
        }
      }
    });
  });

  return aggregate;
};

export default StatsCalculator;
