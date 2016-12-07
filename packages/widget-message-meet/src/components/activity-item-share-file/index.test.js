import React from 'react';
import renderer from 'react-test-renderer';

import ActivityItemShareFile from '.';

describe(`ActivityItemShareFile component`, () => {
  const props = {
    file: {
      displayName: `testImage.js`,
      url: `http://cisco.com`
    },
    onDownloadClick: jest.fn()
  };

  const component = renderer.create(
    <ActivityItemShareFile {...props} />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
