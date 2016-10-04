import React from 'react';
import {createRenderer} from 'react-addons-test-utils';

import TitleBar from '.';

let displayName;
let component;

describe(`TitleBar component`, () => {
  beforeEach(() => {
    const renderer = createRenderer();
    displayName = `test@testing.net`;
    component = renderer.render(
      <TitleBar displayName={displayName} />
    );
  });

  it(`renders`, () => {
    expect(component.type).toBe(`div`);
  });

});
