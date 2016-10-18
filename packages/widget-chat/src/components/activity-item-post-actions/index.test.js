import React from 'react';
import renderer from 'react-test-renderer';

import ActivityItemPostActions from '.';

describe(`ActivityItemPostActions component`, () => {
  const component = renderer.create(
    <ActivityItemPostActions id="abc-123" />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
