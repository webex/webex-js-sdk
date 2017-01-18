import React from 'react';

import createComponentWithIntl from '../../utils/createComponentWithIntl';
import LoadingScreen from '.';

describe(`LoadingScreen component`, () => {

  const component = createComponentWithIntl(
    <LoadingScreen />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
