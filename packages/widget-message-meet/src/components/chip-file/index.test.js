import React from 'react';
import renderer from 'react-test-renderer';

import ChipFile from '.';

describe(`ChipFile component`, () => {
  const props = {
    name: `testFile.jpg`,
    size: `123 KB`,
    thumbnail: `blob:localhost/testFile.jpg`,
    type: `image`
  };
  const component = renderer.create(<ChipFile {...props} />);

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
