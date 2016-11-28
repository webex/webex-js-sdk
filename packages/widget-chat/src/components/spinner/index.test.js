import React from 'react';
import renderer from 'react-test-renderer';

import Spinner from '.';

describe(`Spinner component`, () => {

  const component = renderer.create(
    <Spinner />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
