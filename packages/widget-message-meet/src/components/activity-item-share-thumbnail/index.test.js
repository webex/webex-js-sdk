import React from 'react';
import {Map} from 'immutable';
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
      onDownloadClick: jest.fn(),
      thumbnail: new Map({
        isFetching: true
      })
    };
  });

  it(`renders loading state properly`, () => {
    const component = renderer.create(
      <ActivityShareThumbnail {...props} />
    ).toJSON();
    expect(component).toMatchSnapshot();
  });

  it(`renders thumbnail properly`, () => {
    props.thumbnail.set(`isFetching`, false);
    props.thumbnail.set(`objectUrl`, `blob:localhost/testFile`);
    const component = renderer.create(
      <ActivityShareThumbnail {...props} />
    ).toJSON();
    expect(component).toMatchSnapshot();
  });

});
