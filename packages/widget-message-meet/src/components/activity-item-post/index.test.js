import React from 'react';
import renderer from 'react-test-renderer';

import ActivityItemPost from '.';

describe(`ActivityItemPost post component`, () => {
  const activity = {
    id: `test-123-123-123-123`,
    isSelf: true,
    content: `Test Activity Content`,
    name: `Test User`,
    timestamp: `2016-09-20T19:52:57.186Z`,
    verb: `post`
  };

  const component = renderer.create(
    <ActivityItemPost {...activity} />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
