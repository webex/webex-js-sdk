import React from 'react';
import ChatWidget from './chat-widget';
import {findRenderedDOMComponentWithTag, renderIntoDocument} from 'react-addons-test-utils';

it(`is rendered properly`, () => {
  const widget = renderIntoDocument(
    <ChatWidget />
  );

  const widgetNode = findRenderedDOMComponentWithTag(widget, `h1`);

  expect(widgetNode.textContent).toBe(`Chat Widget!`);
});
