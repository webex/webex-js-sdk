import React from 'react';
import renderer from 'react-test-renderer';

import ActivityItemSystemMessage from '.';

describe(`ActivityItemSystemMessage tombstone component`, () => {
  const activity = {
    id: `test-123-123-123-123`,
    name: `Test User`,
    timestamp: `2016-09-20T19:52:57.186Z`,
    verb: `tombstone`
  };

  const component = renderer.create(
    <ActivityItemSystemMessage
      id={activity.id}
      name={activity.name}
      timestamp={activity.timestamp}
      verb={activity.verb}
    />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});

describe(`ActivityItemSystemMessage tombstone component is self`, () => {
  const activity = {
    id: `test-123-123-123-123`,
    name: `Test User`,
    timestamp: `2016-09-20T19:52:57.186Z`,
    verb: `tombstone`
  };

  const component = renderer.create(
    <ActivityItemSystemMessage
      id={activity.id}
      isSelf
      name={activity.name}
      timestamp={activity.timestamp}
      verb={activity.verb}
    />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});

describe(`ActivityItemSystemMessage create component`, () => {
  const activity = {
    id: `test-123-123-123-123`,
    name: `Test User`,
    timestamp: `2016-09-20T19:52:57.186Z`,
    verb: `create`
  };

  const component = renderer.create(
    <ActivityItemSystemMessage
      id={activity.id}
      name={activity.name}
      timestamp={activity.timestamp}
      verb={activity.verb}
    />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});

