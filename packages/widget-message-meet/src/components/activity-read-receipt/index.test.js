import React from 'react';
import renderer from 'react-test-renderer';

import ActivityReadReceipt from '.';

describe(`ActivityReadReceipt component`, () => {
  const mockReadUsers = [`bernie`, `adam`];
  const component = renderer.create(
    <ActivityReadReceipt actors={mockReadUsers} />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
