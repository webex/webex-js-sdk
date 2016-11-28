import React from 'react';
import renderer from 'react-test-renderer';

import TitleBar from '.';

let displayName;
let component;

describe(`TitleBar component`, () => {
  beforeEach(() => {
    displayName = `test@testing.net`;
    component = renderer.create(
      <TitleBar displayName={displayName} />
    ).toJSON();
  });

  it(`renders correctly`, () => {
    expect(component).toMatchSnapshot();
  });

});
