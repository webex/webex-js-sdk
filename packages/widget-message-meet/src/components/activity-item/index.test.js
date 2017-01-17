import React from 'react';

import createComponentWithIntl from '../../utils/createComponentWithIntl';

import ActivityItem from '.';

describe(`ActivityItem post component is self`, () => {
  const activity = {
    id: `test-123-123-123-123`,
    isSelf: true,
    activity: {
      displayName: `Test Activity Content`
    },
    onActivityDelete: jest.fn(),
    name: `Test User`,
    timestamp: `2016-09-20T19:52:57.186Z`,
    verb: `post`
  };

  const component = createComponentWithIntl(
    <ActivityItem {...activity} />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});

describe(`ActivityItem post component not self`, () => {
  const activity = {
    id: `test-123-123-123-123`,
    isSelf: false,
    activity: {
      displayName: `Test Activity Content`
    },
    name: `Test User`,
    timestamp: `2016-09-20T19:52:57.186Z`,
    verb: `post`
  };

  const component = createComponentWithIntl(
    <ActivityItem {...activity} />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});

describe(`ActivityItem post component not self with html`, () => {
  const activity = {
    id: `test-123-123-123-123`,
    isSelf: false,
    activity: {
      content: `<pre>js.func();</pre>`,
      displayName: `Test Activity Content`
    },
    name: `Test User`,
    timestamp: `2016-09-20T19:52:57.186Z`,
    verb: `post`
  };

  const component = createComponentWithIntl(
    <ActivityItem {...activity} />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});


describe(`ActivityItem tombstone component`, () => {
  const activity = {
    id: `test-123-123-123-123`,
    activity: {
      displayName: `Test Activity Content`
    },
    name: `Test User`,
    timestamp: `2016-09-20T19:52:57.186Z`,
    verb: `tombstone`
  };

  const component = createComponentWithIntl(
    <ActivityItem {...activity} />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
