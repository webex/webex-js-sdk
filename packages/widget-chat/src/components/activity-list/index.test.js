import React from 'react';
import renderer from 'react-test-renderer';

import ActivityList from '.';

describe(`ActivityList component`, () => {
  const activities = [{
    id: `test-123-123-123-123`,
    actor: {
      id: 1,
      displayName: `Test User 1`
    },
    object: {
      displayName: `Test Activity Content 1`
    },
    published: `2016-09-20T19:52:57.186Z`,
    verb: `post`
  }, {
    id: `test-456-123-456-123`,
    actor: {
      id: 2,
      displayName: `Test User 2`
    },
    object: {
      displayName: `Test Activity Content 2`
    },
    published: `2016-09-20T19:53:57.186Z`,
    verb: `post`
  }, {
    id: `test-789-123-789-123`,
    actor: {
      id: 3,
      displayName: `Test User 3`
    },
    object: {
      displayName: `Test Activity Content 3`
    },
    published: `2016-09-20T19:54:57.186Z`,
    verb: `post`
  }];

  const onActivityDelete = jest.fn();

  const component = renderer.create(
    <ActivityList
      activities={activities}
      onActivityDelete={onActivityDelete}
    />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
