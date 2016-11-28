import React from 'react';
import renderer from 'react-test-renderer';

import IconButton from '.';

describe(`IconButton component`, () => {
  const onClick = jest.fn();
  const component = renderer.create(
    <IconButton
      onClick={onClick}
      type="delete"
    />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
