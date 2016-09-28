import React from 'react';
import {findRenderedDOMComponentWithClass, renderIntoDocument} from 'react-addons-test-utils';

import ActivityTitleBar from '.';

let user;
let component;

describe(`ActivityTitleBar component`, () => {
  beforeEach(() => {
    user = {
      userId: `test@testing.net`
    };
    component = renderIntoDocument(
      <ActivityTitleBar user={user} />
    );
  });

  it(`renders`, () => {
    const renderedComponent = findRenderedDOMComponentWithClass(component, `activity-title-bar`);
    expect(renderedComponent).toBeDefined();
  });

});
