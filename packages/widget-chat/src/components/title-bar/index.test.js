import React from 'react';
import {findRenderedDOMComponentWithClass, renderIntoDocument} from 'react-addons-test-utils';

import TitleBar from '.';

let user;
let component;

describe(`TitleBar component`, () => {
  beforeEach(() => {
    user = {
      userId: `test@testing.net`
    };
    component = renderIntoDocument(
      <TitleBar user={user} />
    );
  });

  it(`renders`, () => {
    const renderedComponent = findRenderedDOMComponentWithClass(component, `activity-title-bar`);
    expect(renderedComponent).toBeDefined();
  });

});
