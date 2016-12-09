import React from 'react';
import renderer from 'react-test-renderer';

import ActivityItemBase from '.';

describe(`ActivityItemBase component`, () => {
  const activity = {
    id: `test-123-123-123-123`,
    isSelf: true,
    name: `Test User`,
    timestamp: `2016-09-20T19:52:57.186Z`,
    verb: `post`
  };

  const child = <div>{`Test Content`}</div>;

  const component = renderer.create(
    <ActivityItemBase {...activity} >
      {child}
    </ActivityItemBase>
  );

  it(`renders properly`, () => {
    expect(component).toMatchSnapshot();
  });
});
