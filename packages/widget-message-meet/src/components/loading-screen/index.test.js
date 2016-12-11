import React from 'react';
import renderer from 'react-test-renderer';

import LoadingScreen from '.';

describe(`LoadingScreen component`, () => {

  const component = renderer.create(
    <LoadingScreen />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
