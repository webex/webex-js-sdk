import React from 'react';
import renderer from 'react-test-renderer';

import ListSeparator from '.';

describe(`ListSeparator component`, () => {
  it(`renders properly`, () => {
    const component = renderer.create(
      <ListSeparator
        primaryText={`Testing 123`}
      />
    );
    expect(component).toMatchSnapshot();
  });

  it(`renders properly with classes`, () => {
    const component = renderer.create(
      <ListSeparator
        isInformative
        primaryText={`Testing 123`}
      />
    );
    expect(component).toMatchSnapshot();
  });
});
