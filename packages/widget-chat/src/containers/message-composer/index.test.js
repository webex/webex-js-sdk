import React from 'react';
import renderer from 'react-test-renderer';

import MessageComposer from '.';

describe(`MessageComposer component`, () => {
  const component = renderer.create(
    <MessageComposer
      placeholder="Message Placeholder"
      value="This is a message"
    />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });

  // it(`sends message properly`, () => {});

  // it(`handles value change properly`, () => {});

});
