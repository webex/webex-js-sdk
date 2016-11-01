import React from 'react';
import {Provider} from 'react-redux';
import renderer from 'react-test-renderer';

import store from '../../store';

import ActivityShareList from '.';

describe(`ActivityShareList post component`, () => {
  const files = [{
    displayName: `testImage.js`,
    url: `http://cisco.com`
  }];

  const props = {
    avatar: <div />,
    id: `1234-1234-1234-1234`,
    isAdditional: false,
    isSelf: false,
    name: `Test User`,
    onActivityDelete: jest.fn(),
    timestamp: `2016-09-20T19:52:57.186Z`
  };

  const handleClick = jest.fn();

  const component = renderer.create(
    <Provider store={store}>
      <ActivityShareList files={files} onDownloadClick={handleClick} {...props} />
    </Provider>
  ).toJSON();

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
