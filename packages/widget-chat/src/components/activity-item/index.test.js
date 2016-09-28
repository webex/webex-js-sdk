import React from 'react';
import {findRenderedDOMComponentWithTag, renderIntoDocument} from 'react-addons-test-utils';

import ActivityItem from '.';

describe(`ActivityItem component`, () => {
  let activity;
  let component;
  beforeEach(() => {
    activity = {activity: {message: `howdy`}};
    component = renderIntoDocument(
      <ActivityItem activity={activity} />
    );
  });

  it(`is rendered properly`, () => {
    const componentNode = findRenderedDOMComponentWithTag(component, `li`);
    expect(componentNode.textContent).toBe(`howdy`);
  });

});
