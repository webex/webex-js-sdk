import React from 'react';
import {findRenderedDOMComponentWithClass, renderIntoDocument} from 'react-addons-test-utils';

import Avatar from '.';

let displayName;
let component;

describe(`Avatar component`, () => {
  beforeEach(() => {
    displayName = `test@testing.net`;
    component = renderIntoDocument(
      <Avatar displayName={displayName} />
    );
  });

  it(`renders`, () => {
    const renderedComponent = findRenderedDOMComponentWithClass(component, `avatar`);
    expect(renderedComponent).toBeDefined();
  });

});
