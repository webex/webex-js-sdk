import React from 'react';
import renderer from 'react-test-renderer';

import ConfirmationModal from '.';

describe(`ConfirmationModal component`, () => {
  const messages = {
    title: `Delete`,
    body: `Are you sure you want to delete this message?`,
    actionButtonText: `Delete`,
    cancelButtonText: `Cancel`
  };

  const component = renderer.create(
    <ConfirmationModal messages={messages} />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
