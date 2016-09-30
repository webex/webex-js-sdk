import React from 'react';
import {findRenderedDOMComponentWithClass, renderIntoDocument} from 'react-addons-test-utils';

import ActivityReadReceipt from '.';

describe(`ActivityReadReceipt component`, () => {
  let mockReadUsers;
  let component;
  beforeEach(() => {
    mockReadUsers = [{userId: `bernie`}, {userId: `adam`}];
    component = renderIntoDocument(
      <ActivityReadReceipt actors={mockReadUsers} />
    );
  });

  it(`is rendered properly`, () => {
    const renderedComponent = findRenderedDOMComponentWithClass(component, `activity-read-receipt`);
    expect(renderedComponent).toBeDefined();
  });

});
