import React from 'react';

import createComponentWithIntl from '../../utils/createComponentWithIntl';
import SparkLogo from '.';

describe(`SparkLogo component`, () => {

  const component = createComponentWithIntl(
    <SparkLogo />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
