import React from 'react';
import createComponentWithIntl from '../../utils/createComponentWithIntl';

import ActivityList, {ACTIVITY_ITEM_TYPE_ACTIVITY_ITEM} from '.';

describe(`ActivityList component`, () => {
  const activities = [{
    activity: {
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
    },
    avatarUrl: `http://google.com/img.gif`,
    isAdditional: false,
    isFlagged: false,
    isSelf: true,
    type: ACTIVITY_ITEM_TYPE_ACTIVITY_ITEM
  }, {
    activity: {
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
    },
    avatarUrl: `http://google.com/img.gif`,
    isAdditional: true,
    isFlagged: false,
    isSelf: true,
    type: ACTIVITY_ITEM_TYPE_ACTIVITY_ITEM
  }, {
    activity: {
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
    },
    avatarUrl: `http://google.com/img.gif`,
    isAdditional: false,
    isFlagged: true,
    isSelf: false,
    type: ACTIVITY_ITEM_TYPE_ACTIVITY_ITEM

  }];
  const onActivityDelete = jest.fn();
  const onActivityFlag = jest.fn();
  const component = createComponentWithIntl(
    <ActivityList
      activities={activities}
      onActivityDelete={onActivityDelete}
      onActivityFlag={onActivityFlag}
    />
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
