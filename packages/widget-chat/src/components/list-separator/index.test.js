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
    const classNames = [`bold`, `blue`];
    const component = renderer.create(
      <ListSeparator
        classNames={classNames}
        primaryText={`Testing 123`}
      />
    );
    expect(component).toMatchSnapshot();
  });
});
