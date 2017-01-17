import React from 'react';
import renderer from 'react-test-renderer';

import ActivityItemText from '.';

describe(`ActivityItemText component`, () => {
  const content = `Test Text`;

  const component = renderer.create(
    <ActivityItemText content={content} />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
