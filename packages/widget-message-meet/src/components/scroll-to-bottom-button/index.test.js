/* eslint max-nested-callbacks: ["error", 3] */
import React from 'react';
import renderer from 'react-test-renderer';
import ScrollToBottomButton from '.';

describe(`ScrollToBottomButton component`, () => {

  it(`basic renders properly`, () => {
    const component = renderer.create(
      <ScrollToBottomButton />
    );
    expect(component).toMatchSnapshot();
  });

  it(`with text renders properly`, () => {
    const component = renderer.create(
      <ScrollToBottomButton label="Test Label" />
    );
    expect(component).toMatchSnapshot();
  });

});
