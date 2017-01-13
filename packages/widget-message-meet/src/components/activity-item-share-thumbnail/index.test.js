import React from 'react';
import renderer from 'react-test-renderer';

import ActivityShareThumbnail from '.';

describe(`ActivityShareThumbnail post component`, () => {
  let props;

  beforeEach(() => {
    props = {
      file: {
        displayName: `testImage.js`,
        url: `http://cisco.com`,
        fileSize: 1472837,
        objectType: `js`
      },
      isFetching: true,
      isPending: false,
      objectUrl: `blob:localhost/testFile`,
      onDownloadClick: jest.fn()
    };
  });

  it(`renders loading state properly`, () => {
    const component = renderer.create(
      <ActivityShareThumbnail {...props} />
    ).toJSON();
    expect(component).toMatchSnapshot();
  });

  it(`renders thumbnail properly`, () => {
    props.isFetching = true;
    const component = renderer.create(
      <ActivityShareThumbnail {...props} />
    ).toJSON();
    expect(component).toMatchSnapshot();
  });

  it(`renders pending properly`, () => {
    props.isPending = true;
    const component = renderer.create(
      <ActivityShareThumbnail {...props} />
    ).toJSON();
    expect(component).toMatchSnapshot();
  });

});
