import React from 'react';
import ChatWidget from '.';
import {findRenderedDOMComponentWithTag, renderIntoDocument} from 'react-addons-test-utils';

it(`is rendered properly`, () => {
  const widget = TestUtils.renderIntoDocument(
    <ChatWidget />
  );

  const widgetNode = ReactDOM.findDOMNode(widget);

  expect(widgetNode.textContent).toBe(`Chat Widget!`);

});
