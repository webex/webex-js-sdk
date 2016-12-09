import React from 'react';
import moment from 'moment';

import createComponentWithIntl from '../../utils/createComponentWithIntl';

import DaySeparator from '.';

describe(`DaySeparator component`, () => {
  const today = moment(`2001-01-31`);
  const yesterday = moment(today).subtract(1, `days`);
  const aMonthAgo = moment(today).subtract(1, `months`);
  const twoYearsAgo = moment(today).subtract(2, `years`);
  it(`renders properly for today`, () => {
    const fromDate = aMonthAgo;
    const now = today;
    const toDate = today;
    const component = createComponentWithIntl(
      <DaySeparator
        fromDate={fromDate}
        now={now}
        toDate={toDate}
      />
    );
    expect(component).toMatchSnapshot();
  });

  it(`renders properly for yesterday`, () => {
    const fromDate = aMonthAgo;
    const now = today;
    const toDate = yesterday;
    const component = createComponentWithIntl(
      <DaySeparator
        fromDate={fromDate}
        now={now}
        toDate={toDate}
      />
    );
    expect(component).toMatchSnapshot();
  });

  it(`renders properly for a month ago`, () => {
    const fromDate = aMonthAgo;
    const now = today;
    const toDate = aMonthAgo;
    const component = createComponentWithIntl(
      <DaySeparator
        fromDate={fromDate}
        now={now}
        toDate={toDate}
      />
    );
    expect(component).toMatchSnapshot();
  });

  it(`renders properly for more than a year ago`, () => {
    const fromDate = moment(twoYearsAgo).subtract(1, `days`);
    const now = today;
    const toDate = twoYearsAgo;
    const component = createComponentWithIntl(
      <DaySeparator
        fromDate={fromDate}
        now={now}
        toDate={toDate}
      />
    );
    expect(component).toMatchSnapshot();
  });
});
