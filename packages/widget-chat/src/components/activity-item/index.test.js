import React from 'react';
import renderer from 'react-test-renderer';

import ActivityItem from '.';

describe(`ActivityItem component`, () => {
  const activity = {
    id: `test-123-123-123-123`,
    content: `Test Activity Content`
  };

  const component = renderer.create(
    <ActivityItem
      content={activity.content}
      id={activity.id}
    />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
