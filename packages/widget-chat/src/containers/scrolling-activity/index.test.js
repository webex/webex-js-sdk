import React from 'react';
import renderer from 'react-test-renderer';
import {Provider} from 'react-redux';

import store from '../../store';

import ScrollingActivity from '.';

const flags = [];
const activities = [{
  id: `test-123-123-123-123`,
  actor: {
    id: 1,
    displayName: `Test User 1`
  },
  object: {
    displayName: `Test Activity Content 1`
  },
  published: `2016-09-20T19:52:57.186Z`,
  verb: `post`
}, {
  id: `test-456-123-456-123`,
  actor: {
    id: 2,
    displayName: `Test User 2`
  },
  object: {
    displayName: `Test Activity Content 2`
  },
  published: `2016-09-20T19:53:57.186Z`,
  verb: `post`
}, {
  id: `test-789-123-789-123`,
  actor: {
    id: 3,
    displayName: `Test User 3`
  },
  object: {
    displayName: `Test Activity Content 3`
  },
  published: `2016-09-20T19:54:57.186Z`,
  verb: `post`
}];
const avatars = {
  'test-123-123-123-123': `http://googledoodle.jpg`
};
const onActivityDelete = jest.fn();
const onActivityFlag = jest.fn();

describe(`ScrollingActivity container`, () => {
  it(`renders properly`, () => {
    const component = renderer.create(
      <Provider store={store}>
        <ScrollingActivity
          activities={activities}
          avatars={avatars}
          flags={flags}
          onActivityDelete={onActivityDelete}
          onActivityFlag={onActivityFlag}
        />
      </Provider>
    );
    expect(component).toMatchSnapshot();
  });
});
