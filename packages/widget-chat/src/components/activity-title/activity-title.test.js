import React from 'react';
import {findRenderedDOMComponentWithTag, renderIntoDocument} from 'react-addons-test-utils';

import ActivityTitle from './activity-title';

it(`is rendered properly`, () => {
  const title = renderIntoDocument(
    <ActivityTitle heading="Chat Widget Title!" />
  );

  const titleNode = findRenderedDOMComponentWithTag(title, `h2`);

  expect(titleNode.textContent).toBe(`Chat Widget Title!`);
});
