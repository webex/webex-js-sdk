import React from 'react';
import renderer from 'react-test-renderer';

import AddFileButton from '.';

describe(`AddFileButton component`, () => {
  let component, props;

  beforeEach(() => {
    props = {
      onClick: jest.fn(),
      onChange: jest.fn()
    };

  });

  it(`renders properly`, () => {
    component = renderer.create(
      <AddFileButton {...props} />
    );
    expect(component).toMatchSnapshot();
  });

});
