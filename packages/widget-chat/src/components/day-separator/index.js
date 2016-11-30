import React, {PropTypes} from 'react';
import moment from 'moment';

import {FormattedDate, FormattedMessage} from 'react-intl';

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
    text = ( // eslint-disable-line no-extra-parens
      <FormattedDate
        day={`numeric`}
        month={`long`}
        value={toDate.toDate()}
        year={`numeric`}
      />
    );
  }
  // from.day < to.day assume from.day < now.day. must check to.day == now.day
  else if (now.diff(toDate, `days`) === 0) {
    text = ( // eslint-disable-line no-extra-parens
      <FormattedMessage
        defaultMessage={`Today`}
        description={`Day indicator for the current day`}
        id={`today`}
      />
    );
  }
  // from.day < to.day < now.day therefore from cannot be yesterday
  // only need to check to.day == now.day - 1
  else if (moment(now).subtract(1, `days`).diff(toDate, `days`) === 0) {
    text = ( // eslint-disable-line no-extra-parens
      <FormattedMessage
        defaultMessage={`Yesterday`}
        description={`Day indicator for the previous day`}
        id={`yesterday`}
      />
    );
  }
  else {
    // older than yesterday.
    text = ( // eslint-disable-line no-extra-parens
      <FormattedDate
        day={`numeric`}
        month={`long`}
        value={toDate.toDate()}
      />
    );
  }
  return text;
}

componentName.propTypes = {
  fromDate: PropTypes.object.isRequired,
  now: PropTypes.object.isRequired,
  toDate: PropTypes.object.isRequired
};

export default componentName;
