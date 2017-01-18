import React from 'react';
import createComponentWithIntl from '../../utils/createComponentWithIntl';

import NewMessagesSeparator from '.';

describe(`NewMessagesSeparator component`, () => {
  it(`renders properly`, () => {
    const component = createComponentWithIntl(
      <NewMessagesSeparator
        primaryText={`Testing 123`}
      />
    );
    expect(component).toMatchSnapshot();
  });
});
