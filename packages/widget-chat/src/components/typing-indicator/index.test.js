import React from 'react';
import renderer from 'react-test-renderer';

import TypingIndicator from '.';

let component;

describe(`TypingIndicator component`, () => {
  beforeEach(() => {
    component = renderer.create(
      <TypingIndicator />
    ).toJSON();
  });

  it(`renders correctly`, () => {
    expect(component).toMatchSnapshot();
  });

});
