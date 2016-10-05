import React from 'react';
import {findRenderedDOMComponentWithClass, renderIntoDocument} from 'react-addons-test-utils';

import MessageComposer from '.';

let component;

describe(`MessageComposer component`, () => {
  beforeEach(() => {
    component = renderIntoDocument(
      <MessageComposer />
    );
  });

  it(`renders`, () => {
    const renderedComponent = findRenderedDOMComponentWithClass(component, `message-composer`);
    expect(renderedComponent).toBeDefined();
  });

});
