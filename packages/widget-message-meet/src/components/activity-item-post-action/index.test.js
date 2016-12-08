import React from 'react';
import renderer from 'react-test-renderer';

import ActivityItemPostActions from '.';

describe(`ActivityItemPostActions component`, () => {
  const onClick = jest.fn();
  const component = renderer.create(
    <ActivityItemPostActions iconType="abc-123" onClick={onClick} title="abc-123" />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
