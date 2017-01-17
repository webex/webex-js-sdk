import React from 'react';
import renderer from 'react-test-renderer';

import Button from '.';

describe(`Button component`, () => {
  const onClick = jest.fn();
  const component = renderer.create(
    <Button
      iconType="delete"
      onClick={onClick}
    />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
