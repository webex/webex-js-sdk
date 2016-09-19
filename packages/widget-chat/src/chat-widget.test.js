import React from 'react';
import ReactDOM from 'react-dom';
import ChatWidget from './chat-widget';
import TestUtils from 'react-addons-test-utils';

it(`is rendered properly`, () => {
  const widget = TestUtils.renderIntoDocument(
    <ChatWidget />
  );

  const widgetNode = ReactDOM.findDOMNode(widget);

  expect(widgetNode.textContent).toBe(`Chat Widget!`);

});
