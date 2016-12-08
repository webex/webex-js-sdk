import React from 'react';
import renderer from 'react-test-renderer';

import Icon from '.';

describe(`Icon component`, () => {

  const component = renderer.create(
    <Icon
      type="delete"
    />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
