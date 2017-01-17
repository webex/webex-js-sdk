import React from 'react';
import renderer from 'react-test-renderer';

import TextArea from '.';

describe(`TextArea component`, () => {
  const props = {
    className: `test-class`,
    onChange: jest.fn(),
    onKeyDown: jest.fn(),
    onSubmit: jest.fn(),
    placeholder: `TextArea Placeholder`,
    rows: 2,
    value: ``
  };

  const component = renderer.create(
    <TextArea {...props} />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
