import React from 'react';
import renderer from 'react-test-renderer';

import ChipBase from '.';

describe(`ChipBase component`, () => {
  let component;
  const onRemove = jest.fn();
  const props = {
    children: <div />,
    id: `testFile`,
    onRemove
  };

  it(`renders properly`, () => {
    component = renderer.create(<ChipBase {...props} />);
    expect(component).toMatchSnapshot();
  });

});
