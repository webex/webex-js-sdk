import React from 'react';
import renderer from 'react-test-renderer';

import ActivityList from '.';

describe(`ActivityList component`, () => {
  const activities = [{
    id: `test-123-123-123-123`,
    content: `Test Activity Content 1`
  }, {
    id: `test-456-456-456-456`,
    content: `Test Activity Content 2`
  }];

  const component = renderer.create(
    <ActivityList
      activities={activities}
    />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
