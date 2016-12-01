import React from 'react';
import renderer from 'react-test-renderer';

import ListSeparator from '.';

describe(`ListSeparator component`, () => {
  const component = renderer.create(
    <ListSeparator
      primaryText={`Testing 123`}
    />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
