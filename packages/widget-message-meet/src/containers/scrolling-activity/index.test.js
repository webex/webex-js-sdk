import React from 'react';
import createComponentWithIntl from '../../utils/createComponentWithIntl';
import {Provider} from 'react-redux';

import store from '../../selectors/fixtures/mock-store';

import ScrollingActivity from '.';

store.indicators = {typing: []};

const onActivityDelete = jest.fn();
const onActivityFlag = jest.fn();

describe(`ScrollingActivity container`, () => {
  it(`renders properly`, () => {
    const component = createComponentWithIntl(
      <Provider store={store}>
        <ScrollingActivity
          onActivityDelete={onActivityDelete}
          onActivityFlag={onActivityFlag}
        />
      </Provider>
    );
    expect(component).toMatchSnapshot();
  });
  it(`renders properly loading history`, () => {
    const component = createComponentWithIntl(
      <Provider store={store}>
        <ScrollingActivity
          isLoadingHistoryUp
          onActivityDelete={onActivityDelete}
          onActivityFlag={onActivityFlag}
        />
      </Provider>
    );
    expect(component).toMatchSnapshot();
  });
});
