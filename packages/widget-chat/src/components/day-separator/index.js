import React, {PropTypes} from 'react';
import moment from 'moment';

import ListSeparator from '../list-separator';

function componentName(props) {
  const {fromDate, now, toDate} = props;

  return (
    <div>
      <ListSeparator primaryText={calculateDateText(fromDate, now, toDate)} />
    </div>
  );
}


function calculateDateText(fromDate, now, toDate) {
  let text;
  // toDate and fromDate aren't in the same year OR
  // toDate is not in current year, then show year.
  const sameYearMessages = toDate.diff(fromDate, `years`) === 0;
  const sameYearNow = toDate.diff(now, `years`) === 0;
  if (!sameYearMessages || !sameYearNow) {
    text = toDate.format(`MMMM D, YYYY`);
  }

  // from.day < to.day assume from.day < now.day. must check to.day == now.day
  else if (now.diff(toDate, `days`) === 0) {
    text = `Today`;
  }
  // from.day < to.day < now.day therefore from cannot be yesterday
  // only need to check to.day == now.day - 1
  else if (moment(now).subtract(1, `days`).diff(toDate, `days`) === 0) {
    text = `Yesterday`;
  }
  else {
    // older than yesterday.
    text = toDate.format(`MMMM D`);
  }
  return text;
}

componentName.propTypes = {
  fromDate: PropTypes.object.isRequired,
  now: PropTypes.object.isRequired,
  toDate: PropTypes.object.isRequired
};

export default componentName;
