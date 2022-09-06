const CalendarUtil = {

  // calculate the end time for the meeting based on the duration so it's stored on
  // the scheduled meeting item, that way client can display start and end without
  // calculation on their side
  // gets the start time from server, and the duration, and reformats
  /**
   * calculates the end time for meeting
   * @param {Object} item the locus.host property
   * @param {Object} item.start start time of the meeting
   * @param {Object} item.duration duration of the meeting
   * @returns {Object} end time of the meeting
   * @memberof CalendarUtil
   */
  calculateEndTime(item) {
    return {...item, endTime: new Date(new Date(item.start).getTime() + item.durationMinutes * 60000)};
  }
};

export default CalendarUtil;
