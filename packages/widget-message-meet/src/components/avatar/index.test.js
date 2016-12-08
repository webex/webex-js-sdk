import React from 'react';
import renderer from 'react-test-renderer';

import Avatar from '.';

function createAvatar({image, isSelfAvatar, name}) {
  return renderer.create(
    <Avatar image={image} isSelfAvatar={isSelfAvatar} name={name} />
  );
}

describe(`Avatar component`, () => {
  let props;

  beforeEach(() => {
    props = {
      name: `Test User`,
      image: ``,
      isSelfAvatar: false
    };
  });

  it(`renders properly without image`, () => {
    props.image = null;
    expect(createAvatar(props)).toMatchSnapshot();
  });

  it(`renders properly as self avatar`, () => {
    props.isSelfAvatar = true;
    expect(createAvatar(props)).toMatchSnapshot();
  });

  it(`errors without name`, () => {
    props.name = ``;
    expect(createAvatar(props)).toThrow();
  });
});
