import React from 'react';
import renderer from 'react-test-renderer';

import ActivityItemShareFile from '.';

describe(`ActivityItemShareFile component`, () => {
  const props = {
    file: {
      displayName: `testImage.js`,
      url: `http://cisco.com`
    },
    isPending: false,
    onDownloadClick: jest.fn()
  };

  it(`renders properly`, () => {
    const component = renderer.create(
      <ActivityItemShareFile {...props} />);
    expect(component).toMatchSnapshot();
  });

  it(`renders properly while pending`, () => {
    props.isPending = true;
    const component = renderer.create(
      <ActivityItemShareFile {...props} />);
    expect(component).toMatchSnapshot();
  });
});
