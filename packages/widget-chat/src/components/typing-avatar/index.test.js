import React from 'react';
import renderer from 'react-test-renderer';

import TypingAvatar from '.';

describe(`ScrollingActivity container`, () => {
  it(`renders properly`, () => {
    const component = renderer.create(
      <TypingAvatar name={`Testerson`} />
    );
    expect(component).toMatchSnapshot();
  });
  it(`renders properly when typing`, () => {
    const component = renderer.create(
      <TypingAvatar isTyping name={`Testerson`} />
    );
    expect(component).toMatchSnapshot();
  });
});
