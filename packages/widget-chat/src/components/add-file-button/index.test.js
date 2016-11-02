import React from 'react';
import renderer from 'react-test-renderer';

import AddFileButton from '.';

describe(`AddFileButton component`, () => {
  const props = {
    onClick: jest.fn()
  };

  const component = renderer.create(
    <AddFileButton {...props} />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
