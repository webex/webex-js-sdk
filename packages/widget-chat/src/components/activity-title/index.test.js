import React from 'react';
import {findRenderedDOMComponentWithTag, renderIntoDocument} from 'react-addons-test-utils';

import ActivityTitle from '.';

describe(`ActivityTitle component`, () => {
  let heading;
  let title;
  beforeEach(() => {
    heading = `Chat Widget Title!`;
    title = renderIntoDocument(
      <ActivityTitle heading={heading} />
    );
  });

  it(`is rendered properly`, () => {
    const titleNode = findRenderedDOMComponentWithTag(title, `h2`);
    expect(titleNode.textContent).toBe(heading);
  });

});
