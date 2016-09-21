import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-addons-test-utils';

import ActivityTitle from './activity-title';

it(`is rendered properly`, () => {
  const title = TestUtils.renderIntoDocument(
    <ActivityTitle heading="Chat Widget Title!" />
  );

  const titleNode = ReactDOM.findDOMNode(title);

  expect(titleNode.textContent).toBe(`Chat Widget Title!`);
});
