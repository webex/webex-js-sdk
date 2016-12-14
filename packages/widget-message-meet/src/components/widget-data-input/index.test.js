import React from 'react';

import createComponentWithIntl from '../../utils/createComponentWithIntl';
import WidgetDataInput from '.';

describe(`WidgetDataInput component`, () => {

  const component = createComponentWithIntl(
    <WidgetDataInput />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
