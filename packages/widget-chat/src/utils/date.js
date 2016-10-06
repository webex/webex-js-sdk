import moment from 'moment';

/**
 * format
 * - before a week ago from now: MM/DD/YY, h:mm meridiem
 * - yesterday: Yesterday at h:mm
 * - a week ago from now: DAY h:mm meridiem
 * - today: h:mm meridiem
 *
 * @param {Object} time moment object for specific time
 * @returns {String} nicely formatted timestamp
 */
export function formatDate(time) {
  const now = moment();
  time = time || moment();

  switch (typeof time) {
  case `number`:
  case `string`:
    time = moment(time);
    break;
  default:
  }
  // note endOf(day) compare to normalize now no matter how it was created
  if (now.endOf(`day`).diff(time, `days`) === 0) {
    // today
    return time.format(`h:mm A`);
  }
  else if (now.startOf(`day`).diff(time) <= 86400000) {
    // yesterday (60*60*24*1000 = 86400000)
    return time.calendar();
  }
  else if (now.startOf(`day`).diff(time) <= 518400000) {
    // 6 days ago from today (60*60*24*6*1000 = 518400000)
    return time.format(`dddd h:mm A`);
  }
  return time.format(`M/D/YY, h:mm A`);
}
