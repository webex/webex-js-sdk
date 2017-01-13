import React from 'react';
import {Provider} from 'react-redux';
import createComponentWithIntl from '../../utils/createComponentWithIntl';

import ConnectedActivityList from '.';

import store from '../../selectors/fixtures/mock-store';

describe(`ConnectedActivityList`, () => {
  const onActivityDelete = jest.fn();
  const onActivityFlag = jest.fn();

  it(`renders properly`, () => {
    const component = createComponentWithIntl(
      <Provider store={store}>
        <ConnectedActivityList
          onActivityDelete={onActivityDelete}
          onActivityFlag={onActivityFlag}
        />
      </Provider>
    );

    const widget = component.toJSON();

    expect(widget).toMatchSnapshot();
  });
});
