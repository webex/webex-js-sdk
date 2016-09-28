import React from 'react';
import {findRenderedDOMComponentWithClass, renderIntoDocument} from 'react-addons-test-utils';

import Avatar from '.';

let user;
let component;

describe(`Avatar component`, () => {
  beforeEach(() => {
    user = {
      userId: `test@testing.net`
    };
    component = renderIntoDocument(
      <Avatar user={user} />
    );
  });

  it(`renders`, () => {
    const renderedComponent = findRenderedDOMComponentWithClass(component, `avatar-letter`);
    expect(renderedComponent).toBeDefined();
  });

});
